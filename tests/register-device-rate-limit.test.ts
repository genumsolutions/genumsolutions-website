import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * register_device() is SECURITY DEFINER, so it inserts into the shared
 * `devices` fleet table despite RLS restricting that to staff. That is
 * necessary - the alternative (a blanket user INSERT) lets anyone attach any
 * car to their garage - but it meant nothing bounded HOW MUCH a single
 * account could add. One throwaway account could insert unbounded junk
 * unique_ids into the table that every product page, garage and control deck
 * resolves a car through.
 *
 * As with the model_id ordering bug, the defect lives in SQL with no JS
 * module to reach, so these assert the migration TEXT.
 *
 * The most important assertion here is the negative one: a limit that also
 * throttles an owner re-claiming a car they already have would lock real
 * users out of their own garage while still passing every "is there a limit"
 * check. Verified live against the running database:
 *   - re-claiming an owned car: 30/30 accepted
 *   - a flood of new units: stopped at exactly 10, with
 *     "too many new devices added in the last hour (limit 10)"
 */

const FILE = "20261001170000_rate_limit_device_claims.sql";
const MIGRATIONS = join(process.cwd(), "supabase", "migrations");

/** The CREATE statement minus its leading comment block, as SQL not prose. */
function readBody(name: string): string {
  const lines = readFileSync(join(MIGRATIONS, name), "utf8").split("\n");
  let i = 0;
  for (; i < lines.length; i++) {
    const t = (lines[i] ?? "").trim();
    if (t !== "" && !t.startsWith("--")) break;
  }
  const rest = lines.slice(i).join("\n");
  const end = rest.indexOf("$$;");
  if (end === -1) throw new Error(`unterminated plpgsql body in ${name}`);
  return rest.slice(0, end + 3);
}

const body = readBody(FILE);

describe("register_device rate-limits new unit claims", () => {
  it("checks a rolling window on the caller's OWN links", () => {
    // user_devices.created_at, not devices.created_at: the limit is per
    // account, and a user claiming a car somebody else registered months ago
    // must not be charged for that older row.
    expect(body).toMatch(/from public\.user_devices\s+where user_id = auth\.uid\(\)/i);
    expect(body).toMatch(/created_at > now\(\) - interval '1 hour'/i);
  });

  it("does NOT count on devices.created_at", () => {
    // That column describes when a UNIT entered the fleet, which is the wrong
    // axis entirely and would let one early user exhaust everyone's budget.
    expect(body).not.toMatch(/from public\.devices\s+where created_at/i);
  });

  it("exempts a unit the caller already owns", () => {
    // The whole point. Without this, reconnecting one car ten times an hour
    // would lock the owner out - the garage would freeze its last-seen time
    // and look broken.
    expect(body).toMatch(/v_already_owned/i);
    expect(body).toMatch(/if not coalesce\(v_already_owned, false\) then/i);
  });

  it("identifies existing ownership by unique_id through the join", () => {
    expect(body).toMatch(/join public\.devices d on d\.id = ud\.device_id/i);
    expect(body).toMatch(/d\.unique_id = btrim\(p_unique_id\)/i);
  });

  it("raises a clear, actionable error rather than a bare constraint failure", () => {
    // The message is what a developer sees when their test or a user's car
    // trips it, so it has to name the limit and the way out.
    expect(body).toMatch(
      /raise exception 'too many new devices added in the last hour \(limit %\) - try again later'/i
    );
  });

  it("keeps the limit as one named constant, not a magic number inline", () => {
    expect(body).toMatch(/c_max_new_devices_per_hour constant integer := \d+;/i);
    // ...and that constant is what the check compares against.
    expect(body).toMatch(/if v_recent_links >= c_max_new_devices_per_hour then/i);
  });

  it("still requires a session before doing anything", () => {
    expect(body).toMatch(/if auth\.uid\(\) is null then\s*raise exception 'not signed in'/i);
  });

  it("still refuses an unknown model argument", () => {
    expect(body).toMatch(/raise exception 'unknown model_id: %'/i);
  });

  it("still refuses a junk or oversized identity", () => {
    expect(body).toMatch(/raise exception 'invalid unique_id'/i);
  });

  it("preserves the first-write-wins model fix rather than regressing it", () => {
    // This migration redefines the whole function, so it is a place the
    // 20261001160000 fix could silently be lost. Argument order is the bug.
    expect(body).toMatch(/coalesce\(\s*d\.model_id\s*,\s*excluded\.model_id\s*\)/i);
    expect(body).not.toMatch(/coalesce\(\s*excluded\.model_id\s*,\s*d\.model_id\s*\)/i);
  });

  it("keeps the security-definer hardening and grants", () => {
    expect(body).toMatch(/security definer/i);
    expect(body).toMatch(/set search_path = public/i);
    const sql = readFileSync(join(MIGRATIONS, FILE), "utf8");
    expect(sql).toMatch(
      /revoke execute on function public\.register_device\(text, text, text\) from anon/i
    );
    expect(sql).toMatch(
      /grant execute on function public\.register_device\(text, text, text\) to authenticated/i
    );
  });

  it("still links to auth.uid() and never to a caller-supplied owner", () => {
    expect(body).toMatch(/values\s*\(\s*auth\.uid\(\)\s*,\s*v_device_id/i);
    expect(body).not.toMatch(/p_user_id/);
  });
});

describe("the possession gap is documented, not hidden", () => {
  const sql = readFileSync(join(MIGRATIONS, FILE), "utf8");

  /**
   * The comment text with `-- ` prefixes stripped and lines joined by a
   * single space. Matching prose against raw file text is brittle: a
   * re-wrapped sentence breaks the regex even though the meaning is
   * unchanged, and a test that fails on reformatting trains people to ignore
   * it. Normalising first means these assertions care about what was said,
   * not how it was wrapped.
   */
  const prose = sql
    .split("\n")
    .filter((l) => (l ?? "").trim().startsWith("--"))
    .map((l) => (l ?? "").trim().replace(/^--\s?/, ""))
    .join(" ")
    .replace(/\s+/g, " ");

  it("says plainly that this bounds volume and not identity", () => {
    // A rate limit that reads as "attacks are now prevented" would be worse
    // than no comment: the real gap needs a firmware nonce and is still open.
    expect(prose).toMatch(/still cannot prove PHYSICAL POSSESSION/i);
    expect(prose).toMatch(/bounds the damage rather than removing it/i);
    expect(prose).toMatch(/It is NOT a security boundary on its own/i);
  });

  it("names what a real fix would take", () => {
    // Otherwise the next reader assumes a migration closed the gap.
    expect(prose).toMatch(/challenge the FIRMWARE answers/i);
  });
});
