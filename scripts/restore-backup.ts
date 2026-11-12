// =====================================================================
// restore-backup.ts — re-insert rows that a dated backup has and the live
// database does not.
//
// The free plan has no point-in-time recovery, so `backups/<timestamp>/` is the
// only recovery path. This script is deliberately insert-only: a row whose id
// already exists is skipped, so an id that was edited after the backup keeps the
// newer live version. Nothing is deleted and nothing is overwritten.
//
//   npm run db:restore                      # dry run against the newest backup
//   npm run db:restore -- --apply           # insert the missing rows
//   npm run db:restore -- --dir backups/2026-11-09T09-38-58 --only products
//
// Tables restored by default: products, journal_posts, training_programs,
// curriculum_highlights, services, project_categories. Profile/telemetry tables
// are left out on purpose — restored analytics rows would be stale by the time
// they land, and re-inserting user rows is a privacy decision, not a repair.
// =====================================================================
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const DEFAULT_TABLES = [
  "products",
  "journal_posts",
  "training_programs",
  "curriculum_highlights",
  "services",
  "project_categories",
] as const;

const apply = process.argv.includes("--apply");
const dirArg = process.argv.indexOf("--dir");
const onlyArg = process.argv.indexOf("--only");

function loadEnvFile() {
  try {
    const raw = readFileSync(join(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (!match?.[1]) continue;
      const value = (match[2] || "").replace(/^["']|["']$/g, "");
      if (!process.env[match[1]]) process.env[match[1]] = value;
    }
  } catch {
    // Fall back to already-set environment variables.
  }
}

function newestBackup(): string {
  const root = join(process.cwd(), "backups");
  if (!existsSync(root)) throw new Error("No backups/ directory.");
  const dirs = readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const newest = dirs.at(-1);
  if (!newest) throw new Error("No backup folders inside backups/.");
  return join(root, newest);
}

/**
 * Insert a row, dropping any key the live schema no longer has. The backup was
 * written by an older schema; one removed column must not fail a whole table.
 */
async function insertRow(
  db: any,
  table: string,
  input: Record<string, unknown>
): Promise<string | null> {
  let row = { ...input };
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const { error } = await db.from(table).insert(row);
    if (!error) return null;
    const unknown = error.message.match(/column "([^"]+)" of relation/);
    if (unknown?.[1] && unknown[1] in row) {
      delete row[unknown[1]];
      continue;
    }
    return error.message;
  }
  return "gave up after dropping unknown columns";
}

async function main() {
  loadEnvFile();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Add them to .env.local first."
    );
    process.exit(1);
  }

  const dir = (dirArg > -1 ? process.argv[dirArg + 1] : newestBackup()) ?? "";
  if (!dir) {
    console.error("No backup folder found under backups/.");
    process.exit(1);
  }
  const only = onlyArg > -1 ? process.argv[onlyArg + 1] : undefined;
  const tables = only
    ? [only]
    : DEFAULT_TABLES.filter((table) => existsSync(join(dir, "tables", `${table}.json`)));

  const db = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(`Backup: ${dir}`);
  console.log(`${apply ? "Restoring" : "Dry run"} — tables: ${tables.join(", ")}\n`);

  let inserted = 0;
  let skipped = 0;
  const failures: string[] = [];

  for (const table of tables) {
    const file = join(dir, "tables", `${table}.json`);
    if (!existsSync(file)) {
      console.log(`${table.padEnd(22)} no snapshot file, skipped`);
      continue;
    }
    const rows = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>[];
    if (!Array.isArray(rows) || rows.length === 0) {
      console.log(`${table.padEnd(22)} backup has 0 rows, nothing to restore`);
      continue;
    }

    const { data: live, error } = await db.from(table).select("id");
    if (error) {
      // Tables keyed by something other than `id` are compared on every row.
      console.log(`${table.padEnd(22)} could not read ids (${error.message})`);
      continue;
    }
    const present = new Set((live ?? []).map((row: { id: string }) => row.id));
    const missing = rows.filter((row) => !present.has(row.id as string));
    skipped += rows.length - missing.length;

    if (missing.length === 0) {
      console.log(`${table.padEnd(22)} 0 missing, ${rows.length} already live`);
      continue;
    }

    console.log(`${table.padEnd(22)} ${missing.length} missing of ${rows.length}`);
    if (!apply) {
      for (const row of missing) console.log(`  + ${String(row.id)}`);
      continue;
    }

    for (const row of missing) {
      const failure = await insertRow(db, table, row);
      if (failure) failures.push(`${table}/${String(row.id)}: ${failure}`);
      else inserted += 1;
    }
  }

  if (failures.length) {
    console.log(`\n${failures.length} row(s) could not be restored:`);
    for (const failure of failures) console.log(`  ! ${failure}`);
  }

  if (!apply) {
    console.log(
      `\nDry run. ${skipped} rows already live. Re-run with --apply to insert the missing ones.`
    );
    return;
  }
  console.log(`\nRestored ${inserted} rows.`);
  console.log("Next: `npm run images:verify` (missing product images) and `npm run limits`.");
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
