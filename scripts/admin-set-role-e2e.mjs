// =====================================================================
// admin-set-role-e2e.mjs — LIVE verification of the admin-set-role edge
// function (role AND tier paths) exactly the way the APP calls it:
// anon-key client → signInWithPassword → functions.invoke-equivalent
// fetch with the caller's bearer token.
//
//   1. Creates a disposable admin + customer (.invalid emails).
//   2. Admin flips customer tier pro→free→pro via the function; the
//      profile row is re-read through the service role each time.
//   3. Negative checks: no token → 401, non-admin token → 403.
//   4. Cleans up both users. E2E_KEEP=1 keeps them for debugging.
//
// Run:  node scripts/admin-set-role-e2e.mjs
// =====================================================================
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { purgeTestUsers } from "./e2e-helpers.mjs";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (m) env[m[1]] = (m[2] || "").replace(/^["']|["']$/g, "");
}
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const KEEP = process.env.E2E_KEEP === "1";
const rand = Math.random().toString(36).slice(2, 10);
const CUST = `tierfn-cust-${rand}@genumtest.invalid`;
const ADMIN = `tierfn-admin-${rand}@genumtest.invalid`;
const PW = "Xk9!" + rand + "Zq";

const service = createClient(URL_, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const anon = createClient(URL_, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

await purgeTestUsers(service);

let cid, aid;
const results = [];
const assert = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
};

async function callFn(body, token) {
  const r = await fetch(`${URL_}/functions/v1/admin-set-role`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  return { status: r.status, json: await r.json().catch(() => null) };
}

try {
  const cu = await service.auth.admin.createUser({
    email: CUST,
    password: PW,
    email_confirm: true,
  });
  const au = await service.auth.admin.createUser({
    email: ADMIN,
    password: PW,
    email_confirm: true,
  });
  if (cu.error || au.error)
    throw new Error("createUser failed: " + (cu.error?.message || au.error?.message));
  cid = cu.data.user.id;
  aid = au.data.user.id;
  await service.from("profiles").update({ role: "admin" }).eq("id", aid);
  console.log(`test users:\n  admin:    ${ADMIN}\n  customer: ${CUST}`);

  const { data: ses } = await anon.auth.signInWithPassword({ email: ADMIN, password: PW });
  const adminJwt = ses.session.access_token;

  let r = await callFn({ userId: cid, tier: "pro" }, adminJwt);
  const { data: p1 } = await service.from("profiles").select("tier").eq("id", cid).maybeSingle();
  assert(
    "admin tier flip → pro (200 + persisted)",
    r.status === 200 && p1?.tier === "pro",
    `HTTP ${r.status} tier=${p1?.tier}`
  );

  r = await callFn({ userId: cid, tier: "free" }, adminJwt);
  const { data: p2 } = await service.from("profiles").select("tier").eq("id", cid).maybeSingle();
  assert(
    "admin tier flip → free (200 + persisted)",
    r.status === 200 && p2?.tier === "free",
    `HTTP ${r.status} tier=${p2?.tier}`
  );

  r = await callFn({ userId: cid, role: "customer" }, adminJwt);
  assert("role path still works (200)", r.status === 200, `HTTP ${r.status}`);

  r = await callFn({ userId: cid, tier: "gold" }, adminJwt);
  assert("invalid tier rejected (400)", r.status === 400, `HTTP ${r.status}`);

  r = await callFn({ userId: cid, tier: "pro" }, null);
  assert("no-token call rejected (401)", r.status === 401, `HTTP ${r.status}`);

  const { data: cses } = await anon.auth.signInWithPassword({ email: CUST, password: PW });
  r = await callFn({ userId: aid, tier: "free" }, cses.session.access_token);
  assert("non-admin call rejected (403)", r.status === 403, `HTTP ${r.status}`);
} catch (err) {
  assert("harness completed without crash", false, String(err).slice(0, 200));
} finally {
  if (!KEEP) {
    for (const uid of [cid, aid].filter(Boolean)) await service.auth.admin.deleteUser(uid);
    console.log("cleanup: both users removed");
  } else {
    console.log(`E2E_KEEP=1 — kept ${CUST} / ${ADMIN}`);
  }
  const failed = results.filter((x) => !x.ok);
  console.log(
    failed.length === 0
      ? "\nRESULT: ALL CHECKS PASSED ✅"
      : `\nRESULT: ${failed.length} CHECK(S) FAILED ❌`
  );
  process.exit(failed.length === 0 ? 0 : 1);
}
