#!/usr/bin/env node
/**
 * Publish the first-year 3D-printing promotion.
 *
 * Owner (2026-11-14): "i want the promotional price for the 3d printing of the
 * rs. 10 per gram in the landing page … say that is for a year only strictly as
 * the 1st year promotion … and keep that in the admin panel too properly."
 *
 * What this does, idempotently:
 *   1. Sets the PLA material rate to NPR 10/g, so the calculator and the
 *      advertised "from NPR 10 / gram" agree instead of charging 12.
 *   2. Upserts ONE print_promotions row (matched by title) that carries the
 *      first-year-only wording and a hard end date one year out. Everything
 *      the landing sticker prints comes from this row, so the owner can reword,
 *      re-date or switch it off in Admin → 3D Products → Promotions.
 *
 * Run:  node scripts/publish-print-promo.mjs [--dry]
 * Env:  NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (.env.local works,
 *       the script loads it itself).
 */
import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const dry = process.argv.includes("--dry");

for (const file of [".env.local", ".env"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

const MARKER = "3D printing from NPR 10 / gram";
const startsAt = new Date(2026, 10, 14, 0, 0, 0); // 2026-11-14, local (NPT) midnight
const endsAt = new Date(2027, 10, 14, 23, 59, 59); // exactly one year later

const promotion = {
  title: MARKER,
  body:
    "First-year launch offer, strictly for the first year (until 14 November 2027). " +
    "After that the standard PLA rate applies — no renewal, no rollover.",
  image_url: "",
  cta_label: "Get a print quote",
  cta_href: "/3d-printing",
  discount_type: "none",
  discount_value: 0,
  starts_at: startsAt.toISOString(),
  ends_at: endsAt.toISOString(),
  active: true,
  sort_order: 0,
};

async function main() {
  console.log(dry ? "DRY RUN — nothing will be written.\n" : "Publishing…\n");

  // 1. PLA rate → 10 so the ad and the calculator agree.
  const { data: pla, error: plaRead } = await db
    .from("print_materials")
    .select("id, rate_per_gram")
    .eq("id", "pla")
    .maybeSingle();
  if (plaRead) throw new Error(`PLA read failed: ${plaRead.message}`);

  if (!pla) {
    console.log("PLA material row missing — leaving rates untouched.");
  } else if (pla.rate_per_gram === 10) {
    console.log("PLA already 10/gram — no change.");
  } else if (dry) {
    console.log(`Would set PLA rate ${pla.rate_per_gram} → 10.`);
  } else {
    const { error } = await db
      .from("print_materials")
      .update({ rate_per_gram: 10, updated_at: new Date().toISOString() })
      .eq("id", "pla");
    if (error) throw new Error(`PLA update failed: ${error.message}`);
    console.log(`PLA rate ${pla.rate_per_gram} → 10.`);
  }

  // 2. Promotion row.
  const { data: existing, error: findError } = await db
    .from("print_promotions")
    .select("id")
    .eq("title", MARKER)
    .maybeSingle();
  if (findError) throw new Error(`Promotion lookup failed: ${findError.message}`);

  if (existing) {
    if (dry) {
      console.log(`Would update promotion ${existing.id}.`);
    } else {
      const { error } = await db
        .from("print_promotions")
        .update({ ...promotion, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
      if (error) throw new Error(`Promotion update failed: ${error.message}`);
      console.log(`Updated promotion ${existing.id}.`);
    }
  } else if (dry) {
    console.log("Would insert the promotion row.");
  } else {
    const { data, error } = await db
      .from("print_promotions")
      .insert(promotion)
      .select("id")
      .single();
    if (error) throw new Error(`Promotion insert failed: ${error.message}`);
    console.log(`Inserted promotion ${data.id}.`);
  }

  console.log(`\nWindow: ${startsAt.toISOString()} → ${endsAt.toISOString()} (first year only).`);
  console.log("Admin: 3D Products → Promotions (edit wording, dates, on/off).");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
