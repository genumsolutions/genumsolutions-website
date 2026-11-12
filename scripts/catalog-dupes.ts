// =====================================================================
// catalog-dupes.ts — find (and optionally retire) repeated catalog rows.
//
// Two different problems keep the catalog bigger than the shop:
//   1. the same part entered twice under a different id (imports, re-seeds,
//      "test-product-1" residue), and
//   2. the same photo uploaded under a new name on every save, so the bucket
//      holds several copies of one product shot.
//
// This script reports both. `--apply` only ever sets `active = false` and adds a
// note; it never deletes a row or an image. Retiring is reversible from the
// admin panel, deleting is not — and on a free tier the row count is not the
// thing that runs out, bytes are.
//
//   npm run catalog:dupes            # report only
//   npm run catalog:dupes -- --apply # hide the repeats, keep the oldest
// =====================================================================
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const apply = process.argv.includes("--apply");

type Row = {
  id: string;
  name: string;
  sku: string | null;
  price: number;
  image_url: string | null;
  active: boolean;
  created_at: string;
};

function loadEnvFile() {
  try {
    const raw = readFileSync(join(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (!match?.[1]) continue;
      const value = (match[2] || "").replace(/^["']|["']$/g, "");
      if (!process.env[match[1]]) process.env[match[1]] = value;
    }
  } catch {
    // Fall back to already-set environment variables.
  }
}

/** "L298N Motor Driver Module" and "l298n motor-driver module" collide. */
function nameKey(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function main() {
  loadEnvFile();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }
  const db = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await db
    .from("products")
    .select("id, name, sku, price, image_url, active, created_at")
    .order("created_at", { ascending: true });
  if (error) {
    console.error("Could not read products:", error.message);
    process.exit(1);
  }
  const rows = (data ?? []) as Row[];
  console.log(`${rows.length} products in the catalog.\n`);

  const byName = new Map<string, Row[]>();
  const bySku = new Map<string, Row[]>();
  const byImage = new Map<string, Row[]>();
  for (const row of rows) {
    const name = nameKey(row.name);
    if (name) byName.set(name, [...(byName.get(name) ?? []), row]);
    if (row.sku)
      bySku.set(row.sku.toLowerCase(), [...(bySku.get(row.sku.toLowerCase()) ?? []), row]);
    const image = row.image_url?.split("/").pop();
    if (image && !/placeholder/i.test(image))
      byImage.set(image, [...(byImage.get(image) ?? []), row]);
  }

  // Only a repeated NAME is safe to act on: two rows with the same name are the
  // same thing entered twice. A shared SKU or a shared photo is a data-quality
  // warning, not a duplicate — different parts legitimately borrowed one photo
  // during the rebuild, and a SKU that appears twice must be corrected by hand,
  // not hidden.
  const groups: { reason: string; rows: Row[] }[] = [];
  for (const [name, group] of byName)
    if (group.length > 1) groups.push({ reason: `name "${name}"`, rows: group });

  const warnings: string[] = [];
  for (const [sku, group] of bySku)
    if (group.length > 1)
      warnings.push(
        `sku ${sku} is on ${group.length} products: ${group.map((row) => row.id).join(", ")} — needs a correct SKU`
      );
  for (const [image, group] of byImage)
    if (group.length > 1)
      warnings.push(
        `photo ${image} is used by ${group.length} products: ${group.map((row) => row.id).join(", ")} — one of them needs its own shot`
      );
  const testRows = rows.filter((row) => /^test[-_]/i.test(row.id));
  for (const row of testRows)
    warnings.push(`test residue: ${row.id} (${row.name}) — hide or delete it`);

  if (warnings.length) {
    console.log("Data-quality warnings (nothing is hidden for these):");
    for (const warning of warnings) console.log(`  ! ${warning}`);
    console.log("");
  }

  if (groups.length === 0) {
    console.log("No duplicate product names. Nothing to retire.");
    return;
  }

  // Always keep the oldest row of a name group and retire the newer copies.
  const retire = new Map<string, { row: Row; reason: string }>();
  for (const group of groups) {
    const [keep, ...rest] = group.rows;
    if (!keep) continue;
    for (const row of rest) {
      if (row.id === keep.id) continue;
      if (!retire.has(row.id))
        retire.set(row.id, { row, reason: `same ${group.reason} as ${keep.id}` });
    }
  }

  for (const { row, reason } of retire.values()) {
    console.log(
      `  ${row.active ? "RETIRE" : "already hidden"} ${row.id} — ${row.name} (${reason})`
    );
  }

  console.log(`\n${retire.size} repeat row(s). Nothing is deleted; --apply hides them.`);
  if (!apply) return;

  let hidden = 0;
  for (const { row, reason } of retire.values()) {
    const note = [
      row.id,
      `Retired as a duplicate (${reason}) on ${new Date().toISOString().slice(0, 10)}.`,
    ]
      .filter(Boolean)
      .join(" ");
    const { error: updateError } = await db
      .from("products")
      .update({ active: false, note })
      .eq("id", row.id);
    if (updateError) console.warn(`  ! ${row.id}: ${updateError.message}`);
    else hidden += 1;
  }
  console.log(`\nHid ${hidden} repeat row(s). They can be re-activated in the admin panel.`);
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
