// apply-project-prices.mjs — publish prices for the project packages.
//
// The project pricing model (lib/project-pricing.ts) is base charge + linked
// catalog components (with markup) + extras, then bulk tiers and a minimum
// order. No package has linked components yet, so a flat base charge is the
// only price that can be derived today — that is what this script sets.
//
// Idempotent: re-running it re-applies the same rows (approval timestamp moves,
// nothing else). The owner can override any figure in Admin → Projects →
// Pricing; this is a starting point, not the final word.
//
// Run: node scripts/apply-project-prices.mjs [--dry]
import { existsSync, readFileSync } from "node:fs";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://jxgmbodzkmxanuwfaqxo.supabase.co";
const APPROVED_BY = "genumsolutions@gmail.com";

/** NPR, rounded to the nearest 500. Owner-editable in the admin panel. */
const PRICES = {
  "esp32-remote": 4500,
  "obstacle-ir-basic": 6500,
  "obstacle-us-basic": 7500,
  "path-follow-basic": 7500,
  "rf-manual-basic": 8000,
  "2wd1m-basic": 8500,
  "smart-dustbin": 9500,
  "website-client-basic": 10500,
  "website-server-basic": 11500,
  "4wd4m-basic": 14500,
  "self-balancing-basic": 16500,
};

function loadServiceKey() {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) return process.env.SUPABASE_SERVICE_ROLE_KEY;
  for (const file of [".env.local", ".env", ".env.production"]) {
    if (!existsSync(file)) continue;
    const match = readFileSync(file, "utf8").match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/);
    if (match) return match[1].trim().replace(/^["']|["']$/g, "");
  }
  return null;
}

const key = loadServiceKey();
if (!key) {
  console.error("SUPABASE_SERVICE_ROLE_KEY is not set and was not found in .env.local");
  process.exit(1);
}
const dry = process.argv.includes("--dry");
const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};
const npr = (amount) => `NPR ${amount.toLocaleString("en-IN")}`;
const now = new Date().toISOString();

let failures = 0;

for (const [id, amount] of Object.entries(PRICES)) {
  const pricingRow = {
    id,
    package_base_charge: amount,
    component_markup_percent: 0,
    extras: [],
    bulk_tiers: [],
    minimum_order: 0,
    price_status: "approved",
    price_approved_at: now,
    price_approved_by: APPROVED_BY,
    note: "Starting price — owner-editable in Admin → Projects → Pricing.",
    updated_at: now,
  };

  if (dry) {
    console.log(`[dry] ${id} → ${npr(amount)}`);
    continue;
  }

  const pricing = await fetch(
    `${SUPABASE_URL}/rest/v1/project_pricing?on_conflict=id`,
    {
      method: "POST",
      headers: { ...headers, Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify(pricingRow),
    },
  );
  if (!pricing.ok) {
    failures += 1;
    console.error(`pricing ${id} failed: HTTP ${pricing.status} ${await pricing.text()}`);
    continue;
  }

  // The catalog cards read products.price_label, the detail page reads the
  // published pricing row — keep the two saying the same thing.
  const product = await fetch(`${SUPABASE_URL}/rest/v1/products?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ price: amount, price_label: `From ${npr(amount)}` }),
  });
  if (!product.ok) {
    failures += 1;
    console.error(`product ${id} failed: HTTP ${product.status} ${await product.text()}`);
    continue;
  }
  console.log(`${id} → ${npr(amount)} (approved)`);
}

if (failures > 0) {
  console.error(`\n${failures} row(s) failed.`);
  process.exit(1);
}
if (!dry) console.log(`\nDone — ${Object.keys(PRICES).length} packages published.`);
