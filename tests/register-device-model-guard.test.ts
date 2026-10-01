import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * register_device() lets any signed-in user link a unit and report facts
 * about it. The 20261001140000 version resolved the model_id conflict in the
 * WRONG ORDER, so a user's self-reported model overwrote a value a staff
 * member had curated on the SHARED `devices` table. Reproduced live:
 *
 *   curated model before claim : 4wd4m
 *   model after user claim     : smart-dustbin
 *
 * The function's own comment promised the opposite of what it did, and
 * because the mistake lives in SQL there is no JS module for a unit test to
 * exercise - every test in this repo passed while the bug was live.
 *
 * So these tests read the migration files and assert the SQL text. That is
 * unusual, and deliberately so: the failure mode being guarded is exactly
 * "someone edits SQL and no test notices".
 */

const MIGRATIONS = join(process.cwd(), "supabase", "migrations");

function read(name: string): string {
  return readFileSync(join(MIGRATIONS, name), "utf8");
}

/**
 * The CREATE statement without its LEADING comment block.
 *
 * The header deliberately QUOTES the old buggy line to explain the fix, so a
 * naive whole-file search for that string finds the documentation instead of
 * executable SQL. These assertions are about what actually runs.
 *
 * Only the leading block is dropped. Inline comments inside the body are kept
 * on purpose, because one of them carries the reason the argument order
 * matters, and stripping all comments would let a future edit delete the
 * explanation while leaving the tests green.
 *
 * The slice runs to `$$;` so the `security definer` / `set search_path`
 * clauses, which appear BEFORE `as $$`, stay in scope.
 */
function readBody(name: string): string {
  const sql = read(name);
  const lines = sql.split("\n");
  let i = 0;
  for (; i < lines.length; i++) {
    const t = (lines[i] ?? "").trim();
    if (t !== "" && !t.startsWith("--")) break;
  }
  const rest = lines.slice(i).join("\n");
  if (!/create or replace function public\.register_device/i.test(rest)) {
    throw new Error(`no register_device() definition found in ${name}`);
  }
  const end = rest.indexOf("$$;");
  if (end === -1) throw new Error(`unterminated plpgsql body in ${name}`);
  return rest.slice(0, end + 3);
}

const FIX = "20261001160000_fix_register_device_model_overwrite.sql";
const ORIGINAL = "20261001140000_device_claim_rpc_and_backfill.sql";

describe("register_device model_id is first-write-wins", () => {
  const sql = read(FIX);
  const body = readBody(FIX);

  it("keeps the EXISTING curated model rather than the reported one", () => {
    // coalesce() returns its first non-null argument, so argument order is
    // the entire bug. `coalesce(d.model_id, excluded.model_id)` = existing
    // value wins. The old `coalesce(excluded.model_id, d.model_id)` = the
    // caller wins.
    expect(body).toMatch(/model_id\s*=\s*coalesce\(\s*d\.model_id\s*,\s*excluded\.model_id\s*\)/i);
  });

  it("does not reintroduce the caller-wins ordering in the function body", () => {
    // The exact shape that shipped and was wrong. Scoped to the body, because
    // the header quotes it on purpose to document the fix.
    expect(body).not.toMatch(/coalesce\(\s*excluded\.model_id\s*,\s*d\.model_id\s*\)/i);
  });

  it("replaces the original function body rather than adding a second one", () => {
    // Two definitions of the same signature would make the live behaviour
    // depend on search_path ordering, which is exactly the kind of silent
    // difference this file exists to remove.
    expect(sql).toMatch(/create or replace function public\.register_device\s*\(/i);
    expect(sql).not.toMatch(/^\s*create\s+function\s+public\.register_device/im);
  });

  it("still refuses an unknown model argument", () => {
    // The arg is ignored on conflict now, but it is still inserted on a
    // fresh row, so the FK pre-check has to stay or a typo becomes an opaque
    // constraint violation. A live check confirmed mode ids are rejected:
    // register_device('fw:X', 'obstacle-us') -> "unknown model_id".
    expect(body).toMatch(/raise exception 'unknown model_id: %'/i);
  });

  it("keeps deriving the owner from the session, never from an argument", () => {
    expect(body).toMatch(
      /insert into public\.user_devices\s*\(\s*user_id\s*,\s*device_id\s*,\s*display_name\s*\)\s*values\s*\(\s*auth\.uid\(\)/i
    );
    expect(body).not.toMatch(/p_user_id/);
  });

  it("keeps the security-definer hardening", () => {
    expect(body).toMatch(/security definer/i);
    expect(body).toMatch(/set search_path = public/i);
    expect(sql).toMatch(
      /revoke execute on function public\.register_device\(text, text, text\) from anon/i
    );
    expect(sql).toMatch(
      /grant execute on function public\.register_device\(text, text, text\) to authenticated/i
    );
  });

  it("still refreshes the self-reported fields", () => {
    // Deliberately unchanged: last_seen_at and fw_version are facts the unit
    // reports about ITSELF, not curated catalogue data. A garage that never
    // goes stale is the point.
    expect(body).toMatch(/set last_seen_at = now\(\)/i);
    expect(body).toMatch(/fw_version = case/i);
  });

  it("documents the ordering trap next to the line it guards", () => {
    // A future edit that "cleans up" this comment loses the reason the
    // order matters, and the order is not self-evident.
    expect(body).toMatch(/coalesce\(\) returns its first non-null argument/i);
  });
});

describe("the superseded migration is retained for history", () => {
  it("is not edited in place", () => {
    // History must stay reproducible. The fix is a new forward migration; if
    // the old file were rewritten, a fresh `db reset` would apply the fixed
    // function and then silently skip the bug ever existing.
    const original = read(ORIGINAL);
    expect(original).toMatch(/coalesce\(\s*excluded\.model_id\s*,\s*d\.model_id\s*\)/i);
  });
});
