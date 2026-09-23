// =====================================================================
// verify-admin-services.mjs — LIVE verification of the deployed
// `admin-services` edge function against PRODUCTION.
//
// The 2026-09-23 security fix made this function auth-gated (it previously
// wrote with the service role and NO caller check). Provisions a disposable
// STAFF user, signs them in with the real anon key to obtain a JWT, then
// exercises the function exactly like the app does (POST bearer JWT):
//   1. anon/no-token call          -> 401
//   2. staff create probe service  -> 201 (row visible in DB)
//   3. staff update probe          -> 200
//   4. staff toggle probe          -> 200 (active flipped)
//   5. staff delete probe          -> 403 (delete is admin+)
//   6. admin (owner) delete probe  -> 200 (row gone)
// Cleans up the probe user at the end (E2E_KEEP=1 to keep them).
//
// Run: node scripts/verify-admin-services.mjs
// Needs .env.local: NEXT_PUBLIC_SUPABASE_URL + anon + service role keys.
// =====================================================================
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (m) env[m[1]] = (m[2] || "").replace(/^["']|["']$/g, "");
}

const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SVC = env.SUPABASE_SERVICE_ROLE_KEY;
const FN = `${URL}/functions/v1/admin-services`;
const KEEP = process.env.E2E_KEEP === "1";
const rand = Math.random().toString(36).slice(2, 8);
const STAFF_EMAIL = `admin-services-probe-staff-${rand}@genumtest.invalid`;
const OWNER_EMAIL = `admin-services-probe-owner-${rand}@genumtest.invalid`;
const PASSWORD = "Xk9!" + rand + "Zq";
const PROBE_ID = `admin-services-probe-${rand}`;

const svc = createClient(URL, SVC, { auth: { autoRefreshToken: false, persistSession: false } });
const anon = createClient(URL, ANON, { auth: { autoRefreshToken: false, persistSession: false } });

const results = [];
const assert = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
};

async function provision(role, email) {
  const { data, error } = await svc.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error) throw error;
  const uid = data?.user?.id;
  if (!uid) throw new Error(`createUser(${role}) returned no user.id`);
  // profile row is auto-created by the signup trigger; set the role on it.
  const { error: provErr } = await svc.from("profiles").update({ role }).eq("id", uid);
  if (provErr) throw provErr;
  const { data: sess, error: signInError } = await anon.auth.signInWithPassword({
    email,
    password: PASSWORD,
  });
  if (signInError) throw signInError;
  return { id: uid, token: sess.session.access_token };
}

async function callFn(token, body) {
  const res = await fetch(FN, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* ignore */
  }
  return { status: res.status, data };
}

const staffRow = {
  id: PROBE_ID,
  name: "Admin Services Probe",
  category: "Test & Tools",
  description: "Auto-created by verify-admin-services.mjs",
  price_label: "Request quote",
  tag: "Test",
  sort_order: 1000,
};

let staff, owner;
try {
  // 0. Call without a token -> 401
  const anonRes = await callFn("", { action: "list" });
  assert("anon rejected (401)", anonRes.status === 401, `status ${anonRes.status}`);

  staff = await provision("staff", STAFF_EMAIL);
  owner = await provision("owner", OWNER_EMAIL);

  // 1. Staff can list + create + update + toggle
  const list = await callFn(staff.token, { action: "list" });
  assert(
    "staff list (200)",
    list.status === 200 && Array.isArray(list.data?.services),
    `status ${list.status}`
  );

  const created = await callFn(staff.token, { action: "create", service: staffRow });
  assert(
    "staff create (201)",
    created.status === 201,
    `status ${created.status} ${created.data?.error || ""}`
  );

  const { data: dbCheck } = await svc.from("services").select("*").eq("id", PROBE_ID);
  assert(
    "row visible in DB",
    dbCheck?.length === 1 && dbCheck[0].category === "Test & Tools",
    `rows ${dbCheck?.length}`
  );

  const updated = await callFn(staff.token, {
    action: "update",
    service: { ...staffRow, name: "Admin Services Probe v2" },
  });
  assert(
    "staff update (200)",
    updated.status === 200,
    `status ${updated.status} ${updated.data?.error || ""}`
  );

  const toggled = await callFn(staff.token, {
    action: "toggle",
    id: PROBE_ID,
    currentStatus: true,
  });
  assert(
    "staff toggle (200)",
    toggled.status === 200 && toggled.data?.active === false,
    `status ${toggled.status}`
  );

  // 2. Staff cannot delete -> 403
  const staffDel = await callFn(staff.token, { action: "delete", id: PROBE_ID });
  assert("staff delete blocked (403)", staffDel.status === 403, `status ${staffDel.status}`);

  // 3. Owner (admin) can delete -> 200
  const ownerDel = await callFn(owner.token, { action: "delete", id: PROBE_ID });
  assert(
    "owner delete (200)",
    ownerDel.status === 200,
    `status ${ownerDel.status} ${ownerDel.data?.error || ""}`
  );

  const { data: dbGone } = await svc.from("services").select("*").eq("id", PROBE_ID);
  assert("row gone from DB", dbGone?.length === 0, `rows ${dbGone?.length}`);

  // 4. Invalid id shape rejected
  const bad = await callFn(staff.token, {
    action: "create",
    service: { id: "Bad ID!", name: "x" },
  });
  assert("bad id rejected (400)", bad.status === 400, `status ${bad.status}`);
} catch (e) {
  assert("THREW", false, e.message);
} finally {
  // Cleanup probe user + any leftover probe row (service deletion requires
  // admin role, do it directly with service role).
  if (!KEEP) {
    try {
      await svc.from("services").delete().eq("id", PROBE_ID);
    } catch {
      /* ignore */
    }
    if (staff) await svc.auth.admin.deleteUser(staff.id);
    if (owner) await svc.auth.admin.deleteUser(owner.id);
  }
  const pass = results.filter((r) => r.ok).length;
  console.log(`\n${pass}/${results.length} checks passed`);
  process.exit(pass === results.length ? 0 : 1);
}
