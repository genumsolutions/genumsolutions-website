// =====================================================================
// cleanup-test-residue.mjs — remove LIVE database test residue left by
// the E2E harnesses and the device benches, so nothing test-related shows
// in the admin UI or the fleet views.
//
// What it matches:
//   ORDERS
//     - orders placed BY `@genumtest.invalid` harness users
//     - orders whose provider_ref / items say "smoke probe"
//   USERS
//     - auth users whose email ends `@genumtest.invalid`
//   DEVICE DATA (added 2026-11-19, owner: "the database might have logged
//   some datas about the device test too")
//     - device_crash_reports from a harness user, from a documented fixture
//       board id, from a TEST-NET address (192.0.2/198.51.100/203.0.113),
//       or whose SSID says "genumtest"
//     - car_profiles carrying a harness marker (fixture profile keys,
//       "smoke"/"e2e" in the name); the @genumtest.invalid users' own rows
//       cascade from auth.users
//
// Deletes (service role):
//   - the matching orders (transactions cascade via orders.id; carts,
//     robot_user_settings, user_settings, push tokens, web push
//     subscriptions cascade via auth.users.id)
//   - the matching device rows (crash reports first, then marked profiles)
//   - the matching auth users with `admin.deleteUser` (profiles + carts +
//     orders + car_profiles + activity cascade from auth.users.id)
//
// SAFETY: dry-run by default. Pass `--apply` to actually delete. The real
// accounts (genumsolutions, nijandangal*, Shankar airi, Shankhamool Art)
// are never matched because their emails are not `@genumtest.invalid` and
// their devices do not carry a fixture board id or a TEST-NET address.
//
// CI: `--fail-on-residue` exits 1 when anything WOULD be removed, so the
// db-hygiene job fails until the workflow (or a human) applies the cleanup.
//
// Run:  node scripts/cleanup-test-residue.mjs [--apply] [--fail-on-residue]
// Needs SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL, either in
// .env.local (local) or in the process environment (CI).
// =====================================================================
import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = {};
if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (m) env[m[1]] = (m[2] || "").replace(/^["']|["']$/g, "");
  }
}
// CI supplies the same two values as real environment variables.
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "cleanup-test-residue: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required (.env.local or environment)."
  );
  process.exit(2);
}

const APPLY = process.argv.includes("--apply");
const FAIL_ON_RESIDUE = process.argv.includes("--fail-on-residue");
const service = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ---- scan candidate users + orders ---------------------------------------------
const { data: users, error: usersErr } = await service.auth.admin.listUsers({ perPage: 1000 });
if (usersErr) throw new Error("listUsers: " + usersErr.message);
const testUsers = (users?.users ?? []).filter((u) =>
  u.email?.toLowerCase().endsWith("@genumtest.invalid")
);
const testUserIds = new Set(testUsers.map((u) => u.id));

const orders = [];
const smiles = ["%@genumtest.invalid%", "%smoke probe%"];
for (const like of smiles) {
  const { data, error } = await service
    .from("orders")
    .select("id,user_id,status,provider,provider_ref,customer_name,email,items,created_at")
    .ilike(filterField(like), like);
  if (error) throw new Error(`order scan (${like}): ` + error.message);
  for (const row of data || []) if (!orders.some((o) => o.id === row.id)) orders.push(row);
}

function filterField(like) {
  // provider_ref and the items blob are the two places harnesses mark probes
  return like.includes("@") ? "email" : "provider_ref";
}

const byUser = orders.filter((o) => testUserIds.has(o.user_id));
const byMark = orders.filter((o) => !testUserIds.has(o.user_id) && isSmokeProbe(o));

function isSmokeProbe(o) {
  const items = Array.isArray(o.items) ? JSON.stringify(o.items).toLowerCase() : "";
  return (o.provider_ref || "").toLowerCase().includes("smoke") || items.includes("smoke probe");
}

// ---- scan device-test residue ------------------------------------------------
// Fixture board ids the app tests and the earlier bench sheets used. They are
// 6-character hex ids, so no real car can collide unless it literally has one
// of these MACs — and then it IS the fixture.
const FIXTURE_BOARD_IDS = ["AAAAAA", "BBBBBB", "CCCCCC", "ZZZZZZ"];
// RFC 5737 documentation ranges: a real car on a real network can never
// legitimately report one of these as its address.
const TEST_NET_PREFIXES = ["192.0.2.", "198.51.100.", "203.0.113."];

function isTestNet(ip) {
  const value = (ip || "").trim();
  return TEST_NET_PREFIXES.some((prefix) => value.startsWith(prefix));
}

const { data: crashRows, error: crashErr } = await service
  .from("device_crash_reports")
  .select("id,user_id,board_id,ssid,ip,reported_at")
  .limit(1000);
if (crashErr) throw new Error("crash-report scan: " + crashErr.message);
const crashResidue = (crashRows || []).filter(
  (row) =>
    (row.user_id && testUserIds.has(row.user_id)) ||
    FIXTURE_BOARD_IDS.includes((row.board_id || "").trim()) ||
    isTestNet(row.ip) ||
    (row.ssid || "").toLowerCase().includes("genumtest")
);

const { data: profileRows, error: profileErr } = await service
  .from("car_profiles")
  .select("id,user_id,profile_key,car_name,unique_id,updated_at")
  .limit(1000);
if (profileErr) throw new Error("car-profile scan: " + profileErr.message);
const profileResidue = (profileRows || []).filter((row) => {
  if (row.user_id && testUserIds.has(row.user_id)) return true; // cascades anyway
  const key = (row.profile_key || "").toLowerCase();
  const name = (row.car_name || "").toLowerCase();
  const unique = (row.unique_id || "").trim().toUpperCase();
  return (
    FIXTURE_BOARD_IDS.includes(unique) ||
    key.includes("genumtest") ||
    name.includes("smoke") ||
    name.includes("e2e") ||
    name.includes("genumtest")
  );
});

const residueCount = testUsers.length + orders.length + crashResidue.length + profileResidue.length;

console.log(
  `scan: ${(users?.users ?? []).length} auth users total · ${testUsers.length} @genumtest.invalid`
);
console.log(
  `scan: ${orders.length} candidate orders (${byUser.length} from test users, ${byMark.length} marked smoke probes)`
);
console.log(
  `scan: ${crashResidue.length} device crash report(s) · ${profileResidue.length} car profile row(s) carry a test marker`
);

if (!APPLY) {
  console.log("\nDRY RUN — pass --apply to delete. Would remove:");
  for (const u of testUsers)
    console.log(
      `  user ${u.id}  ${u.email}  role=${u.role}  created=${u.created_at ?? ""}`.slice(0, 160)
    );
  for (const o of orders)
    console.log(
      `  order ${o.id}  status=${o.status} provider=${o.provider} ref=${o.provider_ref || ""} by=${o.user_id}`.slice(
        0,
        160
      )
    );
  for (const c of crashResidue)
    console.log(
      `  crash ${c.id}  board=${c.board_id || "?"} ip=${c.ip || "?"} ssid=${c.ssid || "?"} at=${c.reported_at || "?"}`.slice(
        0,
        160
      )
    );
  for (const p of profileResidue)
    console.log(
      `  profile ${p.id}  key=${p.profile_key} name=${p.car_name || "?"} device=${p.unique_id || "?"}`.slice(
        0,
        160
      )
    );
  const { count } = await service.from("orders").select("*", { count: "exact", head: true });
  const profiles = await service
    .from("profiles")
    .select("id,email", { count: "exact", head: true });
  console.log(`\nwould be left: orders=${count} profiles=${profiles.count} (before cleanup)`);
  if (residueCount > 0) {
    console.log(`\nRESULT: ${residueCount} test row(s) still present ❌`);
  } else {
    console.log("\nRESULT: RESIDUE CLEAN ✅");
  }
  if (FAIL_ON_RESIDUE && residueCount > 0) {
    console.log(
      "\nClean it with the db-hygiene workflow (Actions -> DB hygiene -> Run workflow, apply=true)."
    );
    process.exit(1);
  }
  process.exit(0);
}

// ---- actually delete ------------------------------------------------------------
let deletedOrders = 0;
let deletedUsers = 0;
let deletedCrashes = 0;
let deletedProfiles = 0;
for (const o of orders) {
  const { error } = await service.from("orders").delete().eq("id", o.id);
  if (error) {
    console.error(`  delete order ${o.id} FAILED: ${error.message}`);
    continue;
  }
  deletedOrders++;
}
// Device rows first: a crash report's user_id is SET NULL on cascade, so it
// would survive the auth delete and keep showing in the fleet list.
for (const c of crashResidue) {
  const { error } = await service.from("device_crash_reports").delete().eq("id", c.id);
  if (error) {
    console.error(`  delete crash report ${c.id} FAILED: ${error.message}`);
    continue;
  }
  deletedCrashes++;
}
for (const p of profileResidue) {
  const { error } = await service.from("car_profiles").delete().eq("id", p.id);
  if (error) {
    console.error(`  delete car profile ${p.id} FAILED: ${error.message}`);
    continue;
  }
  deletedProfiles++;
}
for (const u of testUsers) {
  const { error } = await service.auth.admin.deleteUser(u.id);
  if (error) {
    console.error(`  delete user ${u.email} FAILED: ${error.message}`);
    continue;
  }
  deletedUsers++;
}
console.log(
  `\nAPPLIED: deleted ${deletedUsers} users · ${deletedOrders} orders · ${deletedCrashes} crash reports · ${deletedProfiles} car profiles`
);

// ---- verify ---------------------------------------------------------------------
const after = (await service.auth.admin.listUsers({ perPage: 1000 })).data?.users ?? [];
const remainUsers = (after || []).filter((u) =>
  u.email?.toLowerCase().endsWith("@genumtest.invalid")
);
const remainOrders = [];
for (const like of ["%@genumtest.invalid%", "%smoke probe%"]) {
  const { data } = await service
    .from("orders")
    .select("id,email,provider_ref")
    .ilike(filterField(like), like);
  for (const row of data || [])
    if (!remainOrders.some((o) => o.id === row.id)) remainOrders.push(row);
}
// Device rows are re-scanned with the same rules; a deletion that silently
// failed must not be reported as clean.
const { data: crashAfter } = await service
  .from("device_crash_reports")
  .select("id,user_id,board_id,ssid,ip")
  .limit(1000);
const remainCrashes = (crashAfter || []).filter(
  (row) =>
    (row.user_id && testUserIds.has(row.user_id)) ||
    FIXTURE_BOARD_IDS.includes((row.board_id || "").trim()) ||
    isTestNet(row.ip) ||
    (row.ssid || "").toLowerCase().includes("genumtest")
);
const clean = remainUsers.length === 0 && remainOrders.length === 0 && remainCrashes.length === 0;
console.log(
  `verify: ${remainUsers.length} test users · ${remainOrders.length} probe orders · ${remainCrashes.length} fixture crash reports remaining`
);
console.log(clean ? "\nRESULT: RESIDUE CLEAN ✅" : "\nRESULT: residue still present ❌");
process.exit(clean ? 0 : 1);
