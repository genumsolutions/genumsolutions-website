// =====================================================================
// verify-link-import.mjs — LIVE verification of the deployed `link-import`
// edge function (preview + create) against PRODUCTION using a disposable
// STAFF user (real anon sign-in JWT), exactly like the app calls it.
//
//   preview MakerWorld URL      -> found:true, title, images[0] cover
//   create MakerWorld URL       -> 201, product row in DB, image uploaded
//   generic URL (example.com)            -> graceful found:false / title
//   generic URL with og:image (Wikipedia) -> title + extracted image (exercises
//     relative URL resolution + Googlebot-UA retry on the generic path)
//   delete probe rows (cleanup)
//
// Run: node scripts/verify-link-import.mjs
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
const FN = `${URL}/functions/v1/link-import`;
const KEEP = process.env.E2E_KEEP === "1";
const rand = Math.random().toString(36).slice(2, 8);
const STAFF_EMAIL = `link-import-probe-staff-${rand}@genumtest.invalid`;
const OWNER_EMAIL = `link-import-probe-owner-${rand}@genumtest.invalid`;
const PASSWORD = "Xk9!" + rand + "Zq";
const MAKERWORLD_URL = process.env.LINK_IMPORT_URL || "https://makerworld.com/en/models/45000";
// Multi-photo design (one of the live sample links) — preview ONLY so a
// create never touches the curated row. Proves gallery + specs extraction.
const SAMPLE_URL = "https://makerworld.com/en/models/559102";

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
  await svc.from("profiles").update({ role }).eq("id", uid).throwOnError();
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

let staff, owner, createdId;
// Snapshot existing product ids so cleanup never deletes curated live rows
// that an upsert might have overwritten (the slug can collide).
const { data: preRows } = await svc.from("products").select("id");
const preExistingIds = new Set((preRows || []).map((r) => r.id));
try {
  // anon rejected
  const anonRes = await callFn("", { action: "preview", url: MAKERWORLD_URL });
  assert("anon rejected (401)", anonRes.status === 401, `status ${anonRes.status}`);

  staff = await provision("staff", STAFF_EMAIL);

  // preview MakerWorld
  const prev = await callFn(staff.token, { action: "preview", url: MAKERWORLD_URL });
  assert(
    "makerworld preview (200)",
    prev.status === 200 && prev.data?.preview,
    `status ${prev.status}`
  );
  const p = prev.data?.preview || {};
  assert("makerworld found:true", p.found === true, p.found);
  assert("makerworld title", Boolean(p.title), `title="${p.title}"`);
  assert("makerworld image cover", p.images?.length > 0, `img=${p.images?.[0]?.slice(0, 60)}`);
  assert("makerworld category 3D Models", p.categoryHint === "3D Models", `hint=${p.categoryHint}`);
  assert(
    "makerworld specs extracted (print profile/weight)",
    Array.isArray(p.specs) && p.specs.length >= 1,
    `specs=${JSON.stringify(p.specs)}`
  );
  assert("makerworld at least one image", p.images.length >= 1, `imgs=${p.images.length}`);
  assert(
    "makerworld description enriched",
    Boolean(p.description) && p.description.length >= 30,
    `len=${p.description.length}`
  );

  // preview-only against the multi-photo sample (no create — never touches the curated row)
  const samp = await callFn(staff.token, { action: "preview", url: SAMPLE_URL });
  const sp = samp.data?.preview || {};
  assert("sample preview (200)", samp.status === 200 && sp.found === true, `status ${samp.status}`);
  assert("sample gallery images extracted", sp.images?.length >= 2, `imgs=${sp.images?.length}`);
  assert(
    "sample specs extracted",
    Array.isArray(sp.specs) && sp.specs.length >= 2,
    `specs=${sp.specs?.length}`
  );

  // create MakerWorld -> row + uploaded image
  const created = await callFn(staff.token, {
    action: "create",
    url: MAKERWORLD_URL,
    product: { category: "3D Models", price: 1500, priceLabel: "Request quote" },
  });
  assert(
    "makerworld create (201)",
    created.status === 201,
    `status ${created.status} ${created.data?.error || ""}`
  );
  const prod = created.data?.product;
  createdId = prod?.id;
  assert("created product has id", Boolean(createdId), createdId);
  assert("price override applied", prod?.price === 1500, `price=${prod?.price}`);
  assert(
    "source link stored in documentation_url",
    prod?.documentation_url === MAKERWORLD_URL,
    prod?.documentation_url
  );
  assert(
    "image_url populated (storage upload)",
    Boolean(prod?.image_url),
    prod?.image_url?.slice(0, 80)
  );
  assert(
    "created product has specs from preview",
    Array.isArray(prod?.specs) && prod.specs.length >= 1,
    `specs=${prod?.specs?.length}`
  );

  // row visible in DB
  if (createdId) {
    const { data: dbRow } = await svc.from("products").select("*").eq("id", createdId);
    assert("row visible in DB", dbRow?.length === 1, `rows ${dbRow?.length}`);
  }

  // generic site fallback (example.invalid -> not reachable; use example.com which returns html)
  const gen = await callFn(staff.token, { action: "preview", url: "https://example.com" });
  assert("generic preview (200)", gen.status === 200, `status ${gen.status}`);
  const gp = gen.data?.preview || {};
  assert(
    "generic found flag (either state is OK)",
    typeof gp.found === "boolean",
    `found=${gp.found} title=${gp.title || '""'}`
  );

  // generic site WITH og:image (Wikipedia) — exercises the rewritten generic
  // meta/relative-image collection + Googlebot-UA retry path
  const gen2 = await callFn(staff.token, {
    action: "preview",
    url: "https://en.wikipedia.org/wiki/3D_printing",
  });
  assert("generic og-image preview (200)", gen2.status === 200, `status ${gen2.status}`);
  const gp2 = gen2.data?.preview || {};
  assert("generic og-image title", Boolean(gp2.title), `title="${gp2.title}"`);
  assert(
    "generic og-image extracted",
    Array.isArray(gp2.images) && gp2.images.length >= 1,
    `imgs=${gp2.images?.length}`
  );

  // invalid URL rejected
  const bad = await callFn(staff.token, { action: "preview", url: "not-a-url" });
  assert("invalid url rejected (400)", bad.status === 400, `status ${bad.status}`);

  // W1 (2026-09-24): upload-image action — downloads a foreign image URL and
  // returns a durable product-images storage URL (the web admin save path's
  // image-parity fix). Then negative: a non-image URL must fail cleanly.
  const upl = await callFn(staff.token, {
    action: "upload-image",
    url: "https://en.wikipedia.org/wiki/3D_printing",
    imageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/1/13/ P1050782_-_Disassembled_MD-83_GPS_-_Wikimedia_Australia.jpg/320px-P1050782_-_Disassembled_MD-83_GPS_-_Wikimedia_Australia.jpg".replace(" ", ""),
  });
  assert(
    "upload-image returns a storage URL (200)",
    upl.status === 200 &&
      typeof upl.data?.imageUrl === "string" &&
      upl.data.imageUrl.includes("/storage/v1/object/public/product-images/"),
    `status ${upl.status} url=${String(upl.data?.imageUrl || "").slice(0, 60)}`
  );
  const uplBad = await callFn(staff.token, {
    action: "upload-image",
    url: "https://example.com",
    imageUrl: "https://example.com/not-an-image",
  });
  assert(
    "upload-image rejects a non-image (4xx/5xx)",
    uplBad.status >= 400,
    `status ${uplBad.status}`
  );
} catch (e) {
  assert("THREW", false, e.message);
} finally {
  if (!KEEP) {
    // Only remove a row this run actually created; never a pre-existing (curated) product.
    if (createdId && !preExistingIds.has(createdId)) {
      try {
        await svc.from("products").delete().eq("id", createdId);
      } catch {
        /* ignore */
      }
    }
    if (staff) await svc.auth.admin.deleteUser(staff.id);
    if (owner) await svc.auth.admin.deleteUser(owner.id);
  }
  console.log(`\n${results.filter((r) => r.ok).length}/${results.length} checks passed`);
  process.exit(results.every((r) => r.ok) ? 0 : 1);
}
