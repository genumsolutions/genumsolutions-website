// =====================================================================
// verify-admin-products.mjs — LIVE verification of the deployed
// `admin-products` edge function against PRODUCTION.
//
// Provisions a disposable STAFF user, signs them in with the real anon
// key to obtain a JWT, then exercises the edge function exactly like the
// app does (supabase.functions.invoke → POST bearer JWT):
//   1. anon/no-token call          -> 401
//   2. staff create probe product  -> 201 (row visible in DB)
//   3. staff update probe          -> 200
//   4. staff delete probe          -> 403 (delete is admin+)
//   5. admin (owner) delete probe  -> 200 (row gone)
// Cleans up the probe user at the end (E2E_KEEP=1 to keep them).
//
// Run: node scripts/verify-admin-products.mjs
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
const FN = `${URL}/functions/v1/admin-products`;
const KEEP = process.env.E2E_KEEP === "1";
const rand = Math.random().toString(36).slice(2, 8);
const STAFF_EMAIL = `admin-products-probe-staff-${rand}@genumtest.invalid`;
const OWNER_EMAIL = `admin-products-probe-owner-${rand}@genumtest.invalid`;
const PASSWORD = "Xk9!" + rand + "Zq";
const PROBE_ID = `admin-products-probe-${rand}`;

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
  name: "Admin Products Probe",
  category: "Test & Tools",
  description: "Auto-created by verify-admin-products.mjs",
  price: 100,
  price_label: "Request quote",
  stock: 0,
  sort_order: 1000,
  image_url: "",
  documentation_url: "https://example.invalid/probe",
};

let staff, owner;
try {
  // 0. Call without a token -> 401
  const anonRes = await callFn("", { action: "list" });
  assert("anon rejected (401)", anonRes.status === 401, `status ${anonRes.status}`);

  staff = await provision("staff", STAFF_EMAIL);
  owner = await provision("owner", OWNER_EMAIL);

  // 1. Staff can list + create + update
  const list = await callFn(staff.token, { action: "list" });
  assert(
    "staff list (200)",
    list.status === 200 && Array.isArray(list.data?.products),
    `status ${list.status}`
  );

  const created = await callFn(staff.token, { action: "create", product: staffRow });
  assert(
    "staff create (201)",
    created.status === 201,
    `status ${created.status} ${created.data?.error || ""}`
  );

  const { data: dbCheck } = await svc.from("products").select("*").eq("id", PROBE_ID);
  assert(
    "row visible in DB",
    dbCheck?.length === 1 && dbCheck[0].category === "Test & Tools",
    `rows ${dbCheck?.length}`
  );

  const updated = await callFn(staff.token, {
    action: "update",
    product: { ...staffRow, name: "Admin Products Probe v2" },
  });
  assert(
    "staff update (200)",
    updated.status === 200,
    `status ${updated.status} ${updated.data?.error || ""}`
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

  const { data: dbGone } = await svc.from("products").select("*").eq("id", PROBE_ID);
  assert("row gone from DB", dbGone?.length === 0, `rows ${dbGone?.length}`);

  // 4. Invalid id shape rejected
  const bad = await callFn(staff.token, {
    action: "create",
    product: { id: "Bad ID!", name: "x" },
  });
  assert("bad id rejected (400)", bad.status === 400, `status ${bad.status}`);
} catch (e) {
  assert("THREW", false, e.message);
} finally {
  // Cleanup probe user + any leftover probe row (owner-user cleanup; probe row
  // deletion requires admin role, do it directly with service role).
  if (!KEEP) {
    try {
      await svc.from("products").delete().eq("id", PROBE_ID);
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
