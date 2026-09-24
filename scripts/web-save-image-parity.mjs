// web-save-image-parity.mjs — W1 (2026-09-24) LIVE probe.
//
// Verifies the exact path the owner reported broken: a product created via
// the WEBSITE admin save flow (PUT /api/admin/products) with an EXTRACTED
// (foreign) image URL now ends up with a product-images STORAGE URL —
// same as the app's create flow — and the image renders through next/image.
//
// Flow (all against production, self-cleaning):
//   1. Provision a staff user (service role) + sign in via /api/auth/login.
//   2. Call the link-import edge with action=preview (foreign image URL).
//   3. PUT /api/admin/products with image = the FOREIGN URL (as the editor does).
//   4. Assert the stored row's image_url is a *.supabase.co storage URL.
//   5. Assert next/image optimizer serves it (HTTP 200 image/*).
//   6. Assert /api/products (public catalog) exposes the storage URL.
//   7. Cleanup: delete the product row + the test user. Never touches
//      pre-existing rows.
//
// Run:  node scripts/web-save-image-parity.mjs
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const BASE = "https://genumsolutions-website.vercel.app";
const rand = Math.random().toString(36).slice(2, 8);
const STAFF_EMAIL = `w1-parity-${rand}@genumtest.invalid`;
const PASSWORD = "Genum-e2e-2026!";
const PROBE_ID = `w1-image-parity-${rand}`;
// A real foreign image URL (the exact class of URL the editor seeds from
// Extract details) + a real source page for the extractor fallback.
const FOREIGN_IMAGE =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/1/13/P1050782_-_Disassembled_MD-83_GPS_-_Wikimedia_Australia.jpg/320px-P1050782_-_Disassembled_MD-83_GPS_-_Wikimedia_Australia.jpg";
const SOURCE_URL = "https://en.wikipedia.org/wiki/3D_printing";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (m) env[m[1]] = (m[2] || "").replace(/^["']|["']$/g, "");
}

const service = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const results = [];
function assert(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

let cookie = "";
async function api(path, method = "GET", body) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const setCookie = res.headers.getSetCookie?.() ?? [];
  for (const c of setCookie) {
    const pair = c.split(";")[0];
    if (/sb-.*-auth-token=/.test(pair)) cookie = pair;
  }
  let data = null;
  try {
    data = await res.json();
  } catch {}
  return { status: res.status, data };
}

try {
  // 1. Provision staff.
  const su = await service.auth.admin.createUser({
    email: STAFF_EMAIL,
    password: PASSWORD,
    email_confirm: true,
  });
  if (su.error) throw new Error("createUser: " + su.error.message);
  await service.from("profiles").update({ role: "staff" }).eq("id", su.data.user.id);

  const login = await api("/api/auth/login", "POST", {
    email: STAFF_EMAIL,
    password: PASSWORD,
  });
  assert("staff sign-in", login.status === 200, `status ${login.status}`);

  // 2. Extract: foreign URL comes back in preview.images (proves the editor
  //    seeding path really yields a non-storage URL).
  const prev = await api("/api/admin/link-import", "POST", {
    action: "preview",
    url: SOURCE_URL,
  });
  const images = prev.data?.preview?.images ?? [];
  const foreign = images.find((u) => typeof u === "string" && !u.includes("supabase.co"));
  assert(
    "extract yields a foreign image URL (the old bug's input)",
    Boolean(foreign),
    `imgs=${images.length}`,
  );

  // 3. Save exactly like AdminProducts' "Save product" does.
  const put = await api("/api/admin/products", "PUT", {
    id: PROBE_ID,
    name: "W1 image parity probe",
    category: "3D Models",
    price: 0,
    priceLabel: "Request quote",
    stock: 0,
    active: true,
    specs: [],
    image: foreign ?? FOREIGN_IMAGE,
    documentationUrl: SOURCE_URL,
  });
  assert("staff PUT save (200)", put.status === 200, `status ${put.status}`);

  // 4. The stored row must carry a STORAGE image URL now.
  const { data: rows } = await service
    .from("products")
    .select("image_url")
    .eq("id", PROBE_ID);
  const stored = rows?.[0]?.image_url ?? "";
  const isStorage =
    /^https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/public\/product-images\//.test(
      stored,
    );
  assert("stored image_url is a product-images storage URL", isStorage, stored.slice(0, 72));

  // 5. next/image optimizer serves it.
  if (isStorage) {
    const opt = await fetch(
      `${BASE}/_next/image?url=${encodeURIComponent(stored)}&w=640&q=75`,
    );
    assert(
      "next/image optimizer serves the stored image",
      opt.status === 200 && (opt.headers.get("content-type") || "").startsWith("image/"),
      `status ${opt.status} type ${opt.headers.get("content-type")}`,
    );
  }

  // 6. Public catalog exposes the storage URL.
  const pub = await fetch(`${BASE}/api/products`);
  const pubArr = await pub.json();
  const pubRow = Array.isArray(pubArr) ? pubArr.find((p) => p.id === PROBE_ID) : null;
  assert(
    "public /api/products carries the storage image",
    Boolean(pubRow?.image) && pubRow.image.includes("/storage/v1/object/public/product-images/"),
    pubRow?.image ? pubRow.image.slice(0, 72) : "row not found",
  );
} catch (e) {
  assert("THREW", false, e.message);
} finally {
  // Cleanup: the probe row + the probe user (never pre-existing data).
  try {
    await service.from("products").delete().eq("id", PROBE_ID);
  } catch {}
  try {
    const { data: u } = await service
      .from("profiles")
      .select("id")
      .eq("email", STAFF_EMAIL)
      .maybeSingle();
    if (u?.id) await service.auth.admin.deleteUser(u.id);
  } catch {}
  const pass = results.filter((r) => r.ok).length;
  console.log(`\n${pass}/${results.length} checks passed`);
  process.exit(pass === results.length ? 0 : 1);
}
