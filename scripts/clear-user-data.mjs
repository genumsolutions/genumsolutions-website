// =====================================================================
// clear-user-data.mjs — clear LOGS / device state / carts for a fresh test,
// while never touching accounts or privileges.
//
// Owner 2026-11-19: "clear the user logs crash or database ... but don't
// delete the created user accounts and their privilege ... clean and fresh
// test of the app and the website and the car".
//
// What is NEVER deleted (checked before and after, the run aborts if any of
// these changed): auth.users, profiles (role/privilege lives there), orders,
// transactions, customer_messages, newsletter_subscribers, products and the
// whole content/catalog side.
//
// Groups (pick with --groups, default "logs"):
//   logs     activity_log, user_activity_log, page_views, app_logs,
//            device_crash_reports, link_import_attempts,
//            car_connection_sessions, car_telemetry
//   devices  car_profiles, user_devices, device_relay_tokens, devices,
//            robot_user_settings
//   carts    carts
//   business transactions, orders, customer_messages — REAL sales and mail.
//            Owner 2026-11-19 chose to clear these too for a from-scratch
//            shop/checkout test; they are backed up like everything else.
//
// Usage (from genumsolutions-website):
//   node scripts/clear-user-data.mjs                 # dry run, counts only
//   node scripts/clear-user-data.mjs --groups logs,devices,carts --apply --yes
//   node scripts/clear-user-data.mjs --apply --yes --backup backups/2026-11-19
//
// Env: NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and
//      SUPABASE_SERVICE_ROLE_KEY. A dry run also needs them (it reads counts).
// =====================================================================
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "")
  .trim()
  .replace(/\/+$/, "");
const SERVICE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const yes = args.includes("--yes");
const groupsArg = args.find((a) => a.startsWith("--groups="))?.split("=")[1];
const groups = (groupsArg ?? "logs")
  .split(",")
  .map((g) => g.trim())
  .filter(Boolean);
const backupDir = args.find((a) => a.startsWith("--backup="))?.split("=")[1] ?? null;

// `filter` must be a PostgREST predicate that matches EVERY row: DELETE without
// a filter is rejected by PostgREST, and some tables have composite primary keys.
const GROUPS = {
  logs: [
    { table: "app_logs", filter: "created_at=gte.1970-01-01" },
    { table: "page_views", filter: "created_at=gte.1970-01-01" },
    { table: "user_activity_log", filter: "created_at=gte.1970-01-01" },
    { table: "activity_log", filter: "created_at=gte.1970-01-01" },
    { table: "device_crash_reports", filter: "reported_at=gte.1970-01-01" },
    { table: "car_connection_sessions", filter: "created_at=gte.1970-01-01" },
    { table: "car_telemetry", filter: "recorded_at=gte.1970-01-01" },
    { table: "link_import_attempts", filter: "created_at=gte.1970-01-01" },
  ],
  devices: [
    { table: "device_relay_tokens", filter: "device_id=not.is.null" },
    { table: "user_devices", filter: "user_id=not.is.null" },
    { table: "car_profiles", filter: "user_id=not.is.null" },
    { table: "robot_user_settings", filter: "user_id=not.is.null" },
    { table: "devices", filter: "id=not.is.null" },
  ],
  carts: [{ table: "carts", filter: "user_id=not.is.null" }],
  business: [
    // transactions.order_id is `on delete cascade`, but deleting the ledger
    // first keeps the intent explicit and works on any cascade setting.
    { table: "transactions", filter: "created_at=gte.1970-01-01" },
    { table: "orders", filter: "created_at=gte.1970-01-01" },
    { table: "customer_messages", filter: "created_at=gte.1970-01-01" },
  ],
};

// Counted before and after; any change aborts the run (with the backup dir
// printed) because it means the service role reached something it must not.
// Always preserved. When the `business` group is requested, the transactional
// tables are targets instead of guards — the guard list is built per run below.
const ALWAYS_PROTECTED = ["profiles"];
const BUSINESS_TABLES = ["orders", "transactions", "customer_messages"];

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.\n" +
      "Locally they live in a .env file; in CI they are repo secrets (see .github/workflows/clear-logs.yml)."
  );
  process.exit(1);
}
for (const g of groups) {
  if (!GROUPS[g]) {
    console.error(`Error: unknown group "${g}". Known: ${Object.keys(GROUPS).join(", ")}.`);
    process.exit(1);
  }
}
if (apply && !yes) {
  console.error(
    "Refusing to delete without --yes. This clears LOGS and device state for every user.\n" +
      "Dry run first: node scripts/clear-user-data.mjs --groups " +
      groups.join(",")
  );
  process.exit(1);
}

const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
};

async function count(table, filter) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*&${filter}`, {
    method: "HEAD",
    headers: { ...headers, Prefer: "count=exact", Range: "0-0" },
  });
  if (!res.ok) throw new Error(`${table}: count failed ${res.status} ${await res.text()}`);
  const range = res.headers.get("content-range") ?? "";
  const total = Number(range.split("/")[1]);
  if (!Number.isFinite(total)) {
    throw new Error(`${table}: no count in Content-Range (${JSON.stringify(range)})`);
  }
  return total;
}

async function fetchAll(table) {
  const rows = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*`, {
      headers: { ...headers, Range: `${from}-${from + pageSize - 1}` },
    });
    if (!res.ok) throw new Error(`${table}: read failed ${res.status} ${await res.text()}`);
    const page = await res.json();
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

async function remove(table, filter) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method: "DELETE",
    headers: { ...headers, Prefer: "count=exact,return=minimal" },
  });
  if (!res.ok) throw new Error(`${table}: delete failed ${res.status} ${await res.text()}`);
}

const plan = groups.flatMap((g) => GROUPS[g]);
const targeted = new Set(plan.map((p) => p.table));
const PROTECTED = [...ALWAYS_PROTECTED, ...BUSINESS_TABLES.filter((t) => !targeted.has(t))];

console.log(`${apply ? "APPLY" : "DRY RUN"} — groups: ${groups.join(", ")}`);
console.log(`Target: ${SUPABASE_URL}`);
console.log("");

const before = {};
for (const { table, filter } of plan) {
  before[table] = await count(table, filter);
  console.log(`  ${table.padEnd(24)} ${String(before[table]).padStart(6)} row(s)`);
}
const protectedBefore = {};
for (const table of PROTECTED) {
  protectedBefore[table] = await count(table, "id=not.is.null");
}
console.log("");
console.log(
  "Preserved: " + PROTECTED.map((t) => `${t} (${protectedBefore[t]})`).join(", ") + " + auth.users"
);

if (!apply) {
  console.log("\nNothing deleted. Re-run with --apply --yes to clear the rows above.");
  process.exit(0);
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outDir = backupDir ?? join("backups", `cleared-${stamp}`);
mkdirSync(outDir, { recursive: true });

for (const { table, filter } of plan) {
  const rows = await fetchAll(table);
  writeFileSync(join(outDir, `${table}.json`), JSON.stringify(rows, null, 2));
  console.log(`  backed up ${table} (${rows.length} rows) -> ${outDir}`);
}

console.log("\nDeleting…");
for (const { table, filter } of plan) {
  await remove(table, filter);
  const after = await count(table, filter);
  console.log(`  ${table.padEnd(24)} ${after === 0 ? "cleared" : `${after} LEFT`}`);
  if (after !== 0) throw new Error(`${table} still has ${after} row(s) after delete.`);
}

console.log("\nVerifying protected tables are untouched…");
for (const table of PROTECTED) {
  const after = await count(table, "id=not.is.null");
  if (after !== protectedBefore[table]) {
    throw new Error(
      `${table} changed from ${protectedBefore[table]} to ${after} — STOP. Backup: ${outDir}`
    );
  }
  console.log(`  ${table.padEnd(24)} ${after} (unchanged)`);
}

console.log(`\nDone. Backup of every deleted row: ${outDir}`);
