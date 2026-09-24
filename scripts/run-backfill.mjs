// =====================================================================
// run-backfill.mjs — U-23 (2026-09-24): re-run the `link-import` edge
// function's `backfill` action, which re-extracts a FULL GALLERY for every
// product that already has a `documentation_url` but an empty `gallery`.
//
// The action is admin+ gated (it rewrites existing rows in bulk). This
// script signs in as an admin/owner via environment credentials and calls
// the edge function exactly like the website admin would.
//
// Env (.env.local): NEXT_PUBLIC_SUPABASE_URL + anon key, plus
//   ADMIN_EMAIL + ADMIN_PASSWORD (an existing admin/owner login).
//
// Run: node scripts/run-backfill.mjs
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
const FN = `${URL}/functions/v1/link-import`;
const email = env.ADMIN_EMAIL || "";
const password = env.ADMIN_PASSWORD || "";
if (!email || !password) {
  console.error("Set ADMIN_EMAIL + ADMIN_PASSWORD in .env.local (an admin/owner login).");
  process.exit(2);
}

const anon = createClient(URL, ANON, { auth: { autoRefreshToken: false, persistSession: false } });
const { data: sess, error } = await anon.auth.signInWithPassword({ email, password });
if (error) {
  console.error(`Sign-in failed: ${error.message}`);
  process.exit(2);
}

const res = await fetch(FN, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${sess.session.access_token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ action: "backfill" }),
});
const data = await res.json();
if (!res.ok) {
  console.error(`backfill failed (${res.status}): ${data?.error || "unknown"}`);
  process.exit(1);
}

const results = data.results || [];
const updated = results.filter((r) => r.status === "updated");
const errors = results.filter((r) => String(r.status).startsWith("error"));
const skipped = results.filter((r) => r.status === "skipped");
console.log(
  `\nprocessed=${data.processed}  updated=${updated.length}  ` +
    `skipped=${skipped.length}  errors=${errors.length}`
);
for (const r of updated) console.log(`  updated ${r.id}  imgs=${r.galleryCount}`);
for (const r of errors) console.error(`  ERROR  ${r.id}  ${r.status}`);
process.exit(errors.length ? 1 : 0);
