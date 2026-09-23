// =====================================================================
// staff-access-e2e.mjs — LIVE verification of the Phase B RBAC matrix
// against PRODUCTION: staff can read/edit everything EXCEPT deletions;
// role changes are admin+; user deletion is owner-only.
//
// What it does, in order:
//   1. Creates three disposable users (.invalid emails): a CUSTOMER, a
//      STAFF member and an ADMIN, provisioning roles via the service role
//      (exactly like admin-set-role does).
//   2. Signs each in through the REAL /api/auth/login in the real Chrome
//      (sessions live in the browser cookie jar — no crafted headers).
//   3. Staff checks — every admin route that staff may use:
//        yes: GET  /api/admin/*                 -> 200
//        yes: PUT  /api/admin/products/:id      -> 200 (touched product)
//        yes: PATCH /api/admin/orders/:id       -> 200 (mark status)
//        yes: POST  /api/admin/users (listRobotSettings) -> 200
//        no:  DELETE /api/admin/products/:id     -> 403
//        no:  PATCH  /api/admin/users (role)     -> 403
//        no:  POST  /api/admin/users (deleteRobotSetting) -> 403
//   4. Admin checks — admin may DELETE content/products but NOT users:
//        yes: DELETE /api/admin/products/:id     -> 200
//        no:  DELETE /api/admin/users            -> 403 (owner-only)
//   5. Customer check — customer on ANY admin route -> 401.
//   6. Cleans EVERYTHING up (touched product rows + bot settings + users)
//      unless E2E_KEEP=1.
//
// Run:  node scripts/staff-access-e2e.mjs
// Needs .env.local: SUPABASE_* keys (already present) + the site deployed
// with the Phase B route gating (E2E_BASE_URL overridable).
// =====================================================================
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { purgeTestUsers } from "./e2e-helpers.mjs";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (m) env[m[1]] = (m[2] || "").replace(/^["']|["']$/g, "");
}

let puppeteer;
try {
  puppeteer = (await import("puppeteer-core")).default;
} catch {
  // puppeteer-core is a dev dependency of the website repo — if missing the
  // harness can't drive a browser, so fail with a clear message.
  console.error("puppeteer-core not installed — run `npm i` in the website repo first.");
  process.exit(1);
}

const BASE = process.env.E2E_BASE_URL || "https://genumsolutions-website.vercel.app";
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const KEEP = process.env.E2E_KEEP === "1";
const rand = Math.random().toString(36).slice(2, 10);
const CUST_EMAIL = `staff-e2e-cust-${rand}@genumtest.invalid`;
const STAFF_EMAIL = `staff-e2e-staff-${rand}@genumtest.invalid`;
const ADMIN_EMAIL = `staff-e2e-admin-${rand}@genumtest.invalid`;
const PASSWORD = "Xk9!" + rand + "Zq";
const PROBE_ID = `staff-access-probe-${rand}`;

const service = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { autoRefreshToken: false, persistSession: false },
  }
);

let custId, staffId, adminId, browser, page;
const results = [];
const assert = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
};

await purgeTestUsers(service);

// All admin API calls run INSIDE the page context so the browser cookie jar
// carries the session — the same mechanism a real signed-in user uses.
async function api(method, path, body = null) {
  return page.evaluate(
    async (url, method, path, body) => {
      const r = await fetch(url + path, {
        method,
        headers: body !== null ? { "Content-Type": "application/json" } : {},
        body: body === null ? undefined : JSON.stringify(body),
      });
      let json = null;
      try {
        json = await r.json();
      } catch {}
      return { status: r.status, json };
    },
    BASE,
    method,
    path,
    body
  );
}

async function signIn(email, password) {
  await page.goto(BASE + "/login", { waitUntil: "networkidle2" });
  return page.evaluate(
    async (email, password) => {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      return res.status;
    },
    email,
    password
  );
}

async function signOut() {
  await page.goto(BASE + "/", { waitUntil: "networkidle2" });
  return page.evaluate(async () => (await fetch("/api/auth/logout", { method: "POST" })).status);
}

try {
  // ---- 1. disposable users + service-role provisioning -------------------------
  const cu = await service.auth.admin.createUser({
    email: CUST_EMAIL,
    password: PASSWORD,
    email_confirm: true,
  });
  if (cu.error) throw new Error("createUser(customer): " + cu.error.message);
  custId = cu.data.user.id;
  const su = await service.auth.admin.createUser({
    email: STAFF_EMAIL,
    password: PASSWORD,
    email_confirm: true,
  });
  if (su.error) throw new Error("createUser(staff): " + su.error.message);
  staffId = su.data.user.id;
  const au = await service.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: PASSWORD,
    email_confirm: true,
  });
  if (au.error) throw new Error("createUser(admin): " + au.error.message);
  adminId = au.data.user.id;

  const { error: provErr } = await service
    .from("profiles")
    .update({ role: "staff" })
    .eq("id", staffId);
  assert("service-role provisioning (staff)", !provErr, provErr?.message);
  await service.from("profiles").update({ role: "admin" }).eq("id", adminId);
  console.log(
    `test users:\n  customer: ${CUST_EMAIL}\n  staff:    ${STAFF_EMAIL}\n  admin:    ${ADMIN_EMAIL}`
  );

  browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    args: [
      "--no-first-run",
      "--disable-features=Translate",
      "--disable-blink-features=AutomationControlled",
    ],
  });
  page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  page.setDefaultTimeout(30000);

  // ---- 2. STAFF: read/edit allowed, deletes + role changes denied -----------------
  const staffLogin = await signIn(STAFF_EMAIL, PASSWORD);
  assert("staff sign-in via /api/auth/login (200)", staffLogin === 200, `HTTP ${staffLogin}`);

  const listProducts = await api("GET", "/api/admin/products");
  assert(
    "staff GET /api/admin/products (200)",
    listProducts.status === 200,
    `HTTP ${listProducts.status}`
  );

  const listOrders = await api("GET", "/api/admin/orders");
  assert(
    "staff GET /api/admin/orders (200)",
    listOrders.status === 200,
    `HTTP ${listOrders.status}`
  );

  const listUsers = await api("GET", "/api/admin/users");
  assert("staff GET /api/admin/users (200)", listUsers.status === 200, `HTTP ${listUsers.status}`);

  // Staff edit: create a probe product then PUT it — edits are staff-allowed.
  const createProbe = await api("PUT", "/api/admin/products", {
    id: PROBE_ID,
    name: "Staff Access Probe",
    category: "Controllers & Boards",
    price: 1,
    priceLabel: "NPR 1",
    sku: PROBE_ID,
    productType: "Retail kit",
    description: "temporary e2e row",
    specs: [],
    stock: 0,
    delivery: "N/A",
    image: "",
    badge: null,
    active: false,
    sortOrder: 9999,
  });
  const probeCreated = createProbe.status === 200;
  assert(
    "staff PUT /api/admin/products (create probe, 200)",
    probeCreated,
    `HTTP ${createProbe.status}`
  );

  const probeEdit = await api("PUT", "/api/admin/products", {
    id: PROBE_ID,
    name: "Staff Access Probe (edited)",
    category: "Controllers & Boards",
    price: 1,
    stock: 2,
  });
  assert(
    "staff PUT /api/admin/products (edit, 200)",
    probeEdit.status === 200,
    `HTTP ${probeEdit.status}`
  );

  const orderStatus = await api("PATCH", "/api/admin/orders", {
    id: "00000000-0000-0000-0000-000000000000",
    status: "pending",
  });
  assert(
    "staff PATCH /api/admin/orders (no-op order, 200 allowed path)",
    orderStatus.status === 200 || orderStatus.status === 404,
    `HTTP ${orderStatus.status}`
  );

  // Staff robot-settings listing is allowed; DELETE profile (robot) must be 403.
  const listRobots = await api("POST", "/api/admin/users", {
    action: "listRobotSettings",
    userId: staffId,
  });
  assert(
    "staff POST /api/admin/users listRobotSettings (200)",
    listRobots.status === 200,
    `HTTP ${listRobots.status}`
  );

  const staffDeleteProduct = await api("DELETE", `/api/admin/products?id=${PROBE_ID}`);
  assert(
    "staff DELETE /api/admin/products?id= -> 403",
    staffDeleteProduct.status === 403,
    `HTTP ${staffDeleteProduct.status}`
  );

  const staffRoleChange = await api("PATCH", "/api/admin/users", {
    userId: adminId,
    role: "staff",
  });
  assert(
    "staff PATCH /api/admin/users role-change -> 403",
    staffRoleChange.status === 403,
    `HTTP ${staffRoleChange.status}`
  );

  const staffRobotDelete = await api("POST", "/api/admin/users", {
    action: "deleteRobotSetting",
    userId: adminId,
    robotId: "nope",
  });
  assert(
    "staff POST /api/admin/users deleteRobotSetting -> 403",
    staffRobotDelete.status === 403,
    `HTTP ${staffRobotDelete.status}`
  );

  // ---- 3. ADMIN: deletes allowed, but NOT user deletion (owner-only) --------------
  await signOut();
  const adminLogin = await signIn(ADMIN_EMAIL, PASSWORD);
  assert("admin sign-in via /api/auth/login (200)", adminLogin === 200, `HTTP ${adminLogin}`);

  const adminDeleteProbe = await api("DELETE", `/api/admin/products?id=${PROBE_ID}`);
  assert(
    "admin DELETE /api/admin/products?id= (probe removed, 200)",
    adminDeleteProbe.status === 200,
    `HTTP ${adminDeleteProbe.status}`
  );

  const adminDeleteUser = await api("DELETE", "/api/admin/users", { userId: custId });
  assert(
    "admin DELETE /api/admin/users -> 403 (owner-only)",
    adminDeleteUser.status === 403,
    `HTTP ${adminDeleteUser.status}`
  );

  const adminJournalDelete = await api("DELETE", "/api/admin/journal?id=never-used-000000000000");
  assert(
    "admin DELETE journal (no-op id, 200 allowed path)",
    adminJournalDelete.status === 200 || adminJournalDelete.status === 404,
    `HTTP ${adminJournalDelete.status}`
  );

  const adminRoleChange = await api("PATCH", "/api/admin/users", {
    userId: custId,
    role: "customer",
  });
  assert(
    "admin PATCH /api/admin/users role-change (200)",
    adminRoleChange.status === 200,
    `HTTP ${adminRoleChange.status}`
  );

  // ---- 4. CUSTOMER: every admin route closed --------------------------------------
  await signOut();
  const custLogin = await signIn(CUST_EMAIL, PASSWORD);
  assert("customer sign-in via /api/auth/login (200)", custLogin === 200, `HTTP ${custLogin}`);

  const custList = await api("GET", "/api/admin/products");
  assert(
    "customer GET /api/admin/products -> 401",
    custList.status === 401,
    `HTTP ${custList.status}`
  );

  const custDelete = await api("DELETE", `/api/admin/products?id=${PROBE_ID}`);
  assert(
    "customer DELETE /api/admin/products?id= -> 401",
    custDelete.status === 401,
    `HTTP ${custDelete.status}`
  );

  const custUsers = await api("GET", "/api/admin/users");
  assert(
    "customer GET /api/admin/users -> 401",
    custUsers.status === 401,
    `HTTP ${custUsers.status}`
  );
} catch (err) {
  assert("harness completed without crash", false, String(err).slice(0, 300));
} finally {
  // ---- 6. cleanup -----------------------------------------------------------------
  if (browser) await browser.close().catch(() => {});
  if (!KEEP) {
    await service.from("products").delete().eq("sku", PROBE_ID);
    await service.from("products").delete().eq("id", PROBE_ID);
    for (const uid of [custId, staffId, adminId].filter(Boolean)) {
      await service.from("robot_user_settings").delete().eq("user_id", uid);
    }
    for (const uid of [custId, staffId, adminId].filter(Boolean)) {
      const { error } = await service.auth.admin.deleteUser(uid);
      assert(`cleanup: user ${uid.slice(0, 8)} removed`, !error, error?.message);
    }
  } else {
    console.log(`E2E_KEEP=1 — kept users ${CUST_EMAIL} / ${STAFF_EMAIL} / ${ADMIN_EMAIL}`);
  }
  const failed = results.filter((r) => !r.ok);
  console.log(
    failed.length === 0
      ? "\nRESULT: ALL CHECKS PASSED ✅"
      : `\nRESULT: ${failed.length} CHECK(S) FAILED ❌`
  );
  process.exit(failed.length === 0 ? 0 : 1);
}
