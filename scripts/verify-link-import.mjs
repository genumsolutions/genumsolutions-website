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
// U-39 (2026-09-26): the canonical SHARE form is /models/<ID>-<slug> — pin it
// so the leading-id parse can never regress.
const MAKERWORLD_SLUG_URL =
  process.env.LINK_IMPORT_SLUG_URL ||
  "https://makerworld.com/en/models/45000-magura-mt5-piston-rings";
// U-25 (2026-09-25): optional live pass through the Next cookie proxy the
// website ADMIN actually calls (/api/admin/link-import), not just the edge
// function directly. When unset, the proxy stanza is SKIPPED (default keeps
// the harness hermetic). Set it to the running site, e.g.
//   $env:LINK_IMPORT_PROXY_URL="http://localhost:3000/api/admin/link-import"
// and the same checks run through the staff cookie session exactly like the
// admin "Extract details" button does.
const PROXY_URL = process.env.LINK_IMPORT_PROXY_URL || "";
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
  const s = sess.session;
  return {
    id: uid,
    email,
    password: PASSWORD,
    token: s.access_token,
    refreshToken: s.refresh_token,
  };
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

// U-35 (2026-09-25): call the website proxy route (/api/admin/link-import)
// exactly like the admin UI does, so the full Next cookie session is
// exercised rather than the raw edge function endpoint.
// U-39 (2026-09-26) FIX: @supabase/ssr 0.12.x uses the SINGLE chunked cookie
// "sb-<project-ref>-auth-token" — the old hand-crafted sb-access/sb-refresh
// pair was never read by the proxy, so the staff pass 401'd even though the
// web admin itself worked fine. The harness now signs in through the REAL
// /api/auth/login and replays the exact Set-Cookie it gets back.
const SITE_BASE = process.env.E2E_SITE_BASE || "https://genumsolutions-website.vercel.app";
async function loginCookie(email, password) {
  const login = await fetch(`${SITE_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!login.ok) throw new Error(`login failed (${login.status})`);
  const setCookies = login.headers.getSetCookie?.() ?? [];
  const pair = setCookies.map((s) => s.split(";")[0]).join("; ");
  if (!pair) throw new Error("login set no cookies");
  return pair;
}
async function callUrl(proxy, cookie, body) {
  const res = await fetch(proxy, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
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
let created2; // U-23: gallery create result (cleaned up in finally)
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
  assert(
    "makerworld at least one image",
    Array.isArray(p.images) && p.images.length >= 1,
    `imgs=${p.images?.length}`
  );
  assert(
    "makerworld description enriched",
    Boolean(p.description) && p.description.length >= 12,
    `len=${p.description.length}`
  );

  // U-39 (2026-09-26): the REAL share form is /models/<ID>-<slug> (ID LEADS).
  // The old synthetic "some-model-title-45000" (trailing id) accidentally
  // passed while real share links failed — pin the real shape now.
  const slug = await callFn(staff.token, {
    action: "preview",
    url: MAKERWORLD_SLUG_URL,
  });
  const slugP = slug.data?.preview || {};
  assert(
    "share-slug URL /models/<ID>-<slug> resolves (found:true)",
    slug.status === 200 && slugP.found === true,
    `status ${slug.status} found=${slugP.found}`
  );
  assert(
    "share-slug URL previews the SAME design (title match)",
    slugP.title === p.title,
    `title="${slugP.title}" vs "${p.title}"`
  );
  // Keep the old synthetic case too: a trailing numeric tail should NOT break
  // the leading-id parse (the leading branch fires first and wins).
  const legacySlug = await callFn(staff.token, {
    action: "preview",
    url: "https://makerworld.com/zh/models/45000-some-model-title",
  });
  const legacyP = legacySlug.data?.preview || {};
  assert(
    "legacy trailing-slug form still resolves (leading id wins)",
    legacySlug.status === 200 && legacyP.found === true,
    `status ${legacySlug.status} found=${legacyP.found}`
  );
  const zh = await callFn(staff.token, {
    action: "preview",
    url: "https://makerworld.com/zh/models/45000",
  });
  const zhP = zh.data?.preview || {};
  assert(
    "zh-locale URL resolves (found:true)",
    zh.status === 200 && zhP.found === true,
    `status ${zh.status} found=${zhP.found}`
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
      "https://upload.wikimedia.org/wikipedia/commons/thumb/1/13/ P1050782_-_Disassembled_MD-83_GPS_-_Wikimedia_Australia.jpg/320px-P1050782_-_Disassembled_MD-83_GPS_-_Wikimedia_Australia.jpg".replace(
        " ",
        ""
      ),
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

  // U-23 (2026-09-24): create persists a FULL gallery (not one image) and the
  // description has been curated (no "Printed N times · likes" annex).
  const created2 = await callFn(staff.token, {
    action: "create",
    url: SAMPLE_URL,
    product: { category: "3D Models", price: 900 },
  });
  const prod2 = created2.data?.product;
  assert("gallery create (201)", created2.status === 201, `status ${created2.status}`);
  assert(
    "gallery populated (>=2 storage urls)",
    Array.isArray(prod2?.gallery) &&
      prod2.gallery.length >= 2 &&
      prod2.gallery.every((u) => u.includes("/storage/v1/object/public/product-images/")),
    `gallery=${prod2?.gallery?.length}`
  );
  assert(
    "primary image is the first gallery entry",
    prod2?.image_url === (prod2?.gallery || [])[0],
    prod2?.image_url?.slice(0, 50)
  );
  assert(
    "import_meta persisted (sourceSite, creator, tags)",
    prod2?.import_meta &&
      typeof prod2?.import_meta?.sourceSite === "string" &&
      Array.isArray(prod2?.import_meta?.tags),
    `meta=${JSON.stringify(prod2?.import_meta).slice(0, 80)}`
  );
  assert(
    "description curated (no print-stats annex)",
    typeof prod2?.description === "string" && !/Printed \d/.test(prod2.description),
    `desc="${prod2?.description?.slice(0, 60)}"`
  );

  // U-23 (2026-09-24): SAME link imported again must UPDATE the existing row
  // (dedupe by documentation_url), not create an orphaned duplicate.
  const deduped = await callFn(staff.token, {
    action: "create",
    url: SAMPLE_URL,
    product: { category: "3D Models", price: 1200 },
  });
  assert("same-link re-create returns 201", deduped.status === 201, `status ${deduped.status}`);
  assert(
    "re-import reuses the SAME id (URL dedupe)",
    deduped.data?.product?.id === created2.data?.product?.id,
    `id=${deduped.data?.product?.id}`
  );
  assert(
    "re-import updates fields (price override applied)",
    deduped.data?.product?.price === 1200,
    `price=${deduped.data?.product?.price}`
  );

  // U-23 (2026-09-24): backfill action — staff rejected, admin accepted.
  const bfStaff = await callFn(staff.token, { action: "backfill" });
  assert("backfill staff rejected (403)", bfStaff.status === 403, `status ${bfStaff.status}`);
  owner = await provision("owner", OWNER_EMAIL);
  // U-39 (2026-09-26): bounded batch. The catalog outgrew the edge runtime's
  // 150s idle limit for a FULL backfill (every target row does live network
  // fetches), so the harness proves the RBAC gate with a tiny limit instead.
  const bf = await callFn(owner.token, { action: "backfill", limit: 1 });
  assert(
    "backfill admin+ accepted (200)",
    bf.status === 200 && typeof bf.data?.processed === "number",
    `status ${bf.status} processed=${bf.data?.processed}`
  );

  // U-25 (2026-09-25): OPT-IN live pass through the actual Next cookie proxy
  // the website ADMIN calls (/api/admin/link-import), instead of only the edge
  // function directly. Hermetic by default: when LINK_IMPORT_PROXY_URL is
  // unset this stanza is SKIPPED (keeps CI green with no running server).
  //
  // When enabled (a local/next dev server is up with a staff-capable DB), it
  // wires the same fail-closed guarantees:
  //   - anonymous + garbage-token calls are rejected with 401 (the cookie
  //     session gate in the route fires, NOT the edge's Bearer check)
  //   - a staff Bearer token IS honored (edge does its own staff+ JWT check,
  //     and the proxy forwards the caller's access_token as Bearer)
  // Run: $env:LINK_IMPORT_PROXY_URL="http://localhost:3000/api/admin/link-import"
  //      node scripts/verify-link-import.mjs
  if (PROXY_URL) {
    console.log(`\n--- proxy pass (${PROXY_URL}) ---`);
    const pAnon = await fetch(PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "preview", url: SAMPLE_URL }),
    });
    assert("proxy rejects anonymous (401)", pAnon.status === 401, `status ${pAnon.status}`);

    const pBad = await fetch(PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer not-a-token" },
      body: JSON.stringify({ action: "preview", url: SAMPLE_URL }),
    });
    assert("proxy rejects garbage token (401)", pBad.status === 401, `status ${pBad.status}`);

    const pStaff = await callUrl(PROXY_URL, await loginCookie(staff.email, staff.password), {
      action: "preview",
      url: SAMPLE_URL,
    });
    assert(
      "proxy honours staff session (edge staff+ check)",
      pStaff.status === 200,
      `status ${pStaff.status}`
    );
  } else {
    console.log("\n--- proxy pass SKIPPED (set LINK_IMPORT_PROXY_URL to run) ---");
  }
} catch (e) {
  assert("THREW", false, e.message);
} finally {
  if (!KEEP) {
    // Only remove rows this run actually created; never pre-existing (curated) products.
    for (const id of [createdId, created2?.data?.product?.id]) {
      if (id && !preExistingIds.has(id)) {
        try {
          await svc.from("products").delete().eq("id", id);
        } catch {
          /* ignore */
        }
      }
    }
    if (staff) await svc.auth.admin.deleteUser(staff.id);
    if (owner) await svc.auth.admin.deleteUser(owner.id);
  }
  console.log(`\n${results.filter((r) => r.ok).length}/${results.length} checks passed`);
  process.exit(results.every((r) => r.ok) ? 0 : 1);
}
