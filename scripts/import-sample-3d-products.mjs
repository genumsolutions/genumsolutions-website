// =====================================================================
// import-sample-3d-products.mjs — imports a few real MakerWorld models as
// live `3D Models` products via the DEPLOYED link-import function (staff
// JWT path), for display + testing on both clients. Owner edits/removes
// later. Re-runnable (same id -> no duplicate; upsert overwrites).
//
// Run: node scripts/import-sample-3d-products.mjs
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

const SAMPLES = [
  {
    url: "https://makerworld.com/en/models/984143",
    product: {
      category: "3D Models",
      price: 0,
      priceLabel: "Request quote",
      stock: 0,
      description:
        "Physics fidget toy that transforms from a spiral into a tree-like shape. Printed on demand.",
    },
  },
  {
    url: "https://makerworld.com/en/models/732526",
    product: {
      category: "3D Models",
      price: 0,
      priceLabel: "Request quote",
      stock: 0,
      description: "Print-in-place 3-in-1 fidget clicker toy. Printed on demand.",
    },
  },
  {
    url: "https://makerworld.com/en/models/559102",
    product: {
      category: "3D Models",
      price: 0,
      priceLabel: "Request quote",
      stock: 0,
      description:
        "Loud and clicky clockwork cog fidget toy, press-fit assembly. Printed on demand.",
    },
  },
];

const svc = createClient(URL, SVC, { auth: { autoRefreshToken: false, persistSession: false } });
const anon = createClient(URL, ANON, { auth: { autoRefreshToken: false, persistSession: false } });

const rand = Math.random().toString(36).slice(2, 8);
const STAFF_EMAIL = `import-3d-samples-${rand}@genumtest.invalid`;
const PASSWORD = "Xk9!" + rand + "Zq";

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

let staffId;
try {
  const { data, error } = await svc.auth.admin.createUser({
    email: STAFF_EMAIL,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error) throw error;
  staffId = data?.user?.id;
  if (!staffId) throw new Error("createUser returned no id");
  await svc.from("profiles").update({ role: "staff" }).eq("id", staffId).throwOnError();
  const { data: sess, error: signInError } = await anon.auth.signInWithPassword({
    email: STAFF_EMAIL,
    password: PASSWORD,
  });
  if (signInError) throw signInError;
  const token = sess.session.access_token;

  for (const s of SAMPLES) {
    const r = await callFn(token, { action: "create", url: s.url, product: s.product });
    const ok = r.status === 201;
    console.log(
      `${ok ? "IMPORTED" : "FAILED"} (${r.status}) ${s.url.split("/").pop()} -> ${r.data?.product?.id || r.data?.error || "?"}`
    );
  }
} catch (e) {
  console.log("THREW", e.message);
} finally {
  if (staffId) {
    try {
      await svc.auth.admin.deleteUser(staffId);
    } catch {
      /* ignore */
    }
  }
}
