// =====================================================================
// scripts/prepare-kits-template.ts — export the 20 unpriced Excel-import
// kits (notRestored in the recovery seed) into an editable pricing template.
//
//   npm run kits:template
//
// Writes data/kits-to-price.json. Fill in `priceNpr` (number) and, if you
// want, adjust `name`/`description`/`specs`; then the restore/insert step
// can consume it (once prices are set).
// =====================================================================
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const srcPath = join(process.cwd(), "data", "catalog-lost-2026-09-23.json");
const outPath = join(process.cwd(), "data", "kits-to-price.json");

type Item = {
  id: string;
  name: string;
  category?: string;
  description?: string;
  specs?: string[];
  price?: number;
  priceLabel?: string;
  [k: string]: unknown;
};

function main() {
  const raw = JSON.parse(readFileSync(srcPath, "utf8")) as {
    notRestored?: { note?: string; items?: Item[] } | Item[];
  };
  const block = raw.notRestored;
  const items: Item[] = Array.isArray(block) ? block : block?.items || [];
  const note = !Array.isArray(block) ? block?.note : undefined;

  const template = {
    generatedAt: new Date().toISOString(),
    source: "data/catalog-lost-2026-09-23.json -> notRestored",
    instructions:
      "Set priceNpr (number, NPR) for each kit you want to restore. Leave null to skip. " +
      "The old price/priceLabel was a combined 'cost / hours' figure and is kept for reference only; " +
      "priceNpr is the value that will be used on insert. After pricing, share this file so the kits can be inserted (insert-only) and verified.",
    seedNote: note || null,
    kits: items.map((it) => ({
      id: it.id,
      name: it.name,
      category: it.category ?? null,
      description: it.description ?? null,
      specs: it.specs ?? [],
      priceNpr: null as number | null,
      referencePrice: it.price ?? null,
      referencePriceLabel: it.priceLabel ?? null,
      status: "needs-price",
    })),
  };

  writeFileSync(outPath, JSON.stringify(template, null, 2) + "\n", "utf8");
  console.log(`Wrote ${outPath} with ${template.kits.length} kit(s) to price.`);
}

main();
