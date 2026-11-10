// =====================================================================
// snapshot-catalog-extras.mjs — writes `lib/catalog-extras-data.ts`, the
// non-retail inventory (3D models + project packages) that lives only in the
// database, so the offline fallback can show the same About counts as live.
//
// The 55 retail items stay hand-maintained in `catalog-data.ts`; these rows are
// owner-created through the admin panel / link-import, so we snapshot them
// rather than retype them. Re-run whenever an admin adds or edits a model or
// package:
//
//   node scripts/snapshot-catalog-extras.mjs        (needs .env.local)
//
// The file it writes is committed; `npm run seed` and both clients' offline
// fallbacks read it.
// =====================================================================
import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (m) env[m[1]] = (m[2] || "").replace(/^["']|["']$/g, "");
}

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

const { data, error } = await db.from("products").select("*").order("sort_order");
if (error) {
  console.error("products read failed:", error.message);
  process.exit(1);
}

const isModel = (row) => (row.category || "").trim().toLowerCase() === "3d models";
const isPackage = (row) => row.product_type === "Project package" || row.category === "Pre-packaged Kits";

/** Row → the Product shape both clients consume (same mapping as content-store). */
const toProduct = (row) => {
  const product = {
    id: row.id,
    name: row.name,
    category: row.category,
    price: row.price ?? 0,
    priceLabel: row.price_label || `NPR ${(row.price ?? 0).toLocaleString("en-IN")}`,
    sku: row.sku || "",
    productType: row.product_type || "Retail kit",
    note: row.note || "",
    description: row.description || "",
    specs: row.specs ?? [],
    audience: row.audience || "Students, schools, hobbyists, and makers",
    difficulty: row.difficulty || "Beginner",
    warranty: row.warranty || "7-day component replacement for manufacturing defects",
    stock: row.stock ?? 0,
    delivery: row.delivery || "Ships in 1–2 working days",
    color: row.color || "from-[#dce8ff] to-[#7e9ff2]",
  };
  const optional = {
    project_category: row.project_category,
    inventoryType: row.inventory_type,
    active: row.active,
    projectOverview: row.project_overview,
    objectives: row.objectives,
    materialsRequired: row.materials_required,
    learningOutcomes: row.learning_outcomes,
    buildSteps: row.build_steps,
    controlMethods: row.control_methods,
    prerequisites: row.prerequisites,
    deliverables: row.deliverables,
    estimatedDuration: row.estimated_duration,
    sourceFolder: row.source_folder,
    documentationUrl: row.documentation_url,
    videoUrl: row.video_url,
    maintenanceNotes: row.maintenance_notes,
    badge: row.badge,
    supplier: row.supplier,
    image: row.image_url,
    gallery: row.gallery,
    // `designId` is stored as a number by link-import but typed as a string.
    importMeta:
      row.import_meta && Object.keys(row.import_meta).length
        ? {
            ...row.import_meta,
            designId:
              row.import_meta.designId === undefined
                ? undefined
                : String(row.import_meta.designId),
          }
        : undefined,
  };
  for (const [key, value] of Object.entries(optional)) {
    if (value !== null && value !== undefined && !(Array.isArray(value) && value.length === 0)) {
      product[key] = value;
    }
  }
  return product;
};

const models = data.filter(isModel).map(toProduct);
const packages = data.filter(isPackage).map(toProduct);

const header = `/**
 * GENERATED — do not edit by hand. \`npm run snapshot:catalog-extras\`
 * rewrites this file from the live \`products\` table.
 *
 * The 55 retail items are hand-maintained in \`catalog-data.ts\`; these are the
 * 3D models and project packages the owner created through the admin panel and
 * link-import, which exist only in the database. Without them the offline
 * fallback reports 0 models / 0 packages while the live site reports
 * ${models.length} / ${packages.length}, so the fallback is the wrong shape.
 */
import type { Product } from "./catalog";

/** 3D models — printed on demand, browsed only on /3d-printing. */
export const catalogModels: Product[] = `;

const out = `${header}${JSON.stringify(models, null, 2)};\n
/** Project packages — browsed on /projects, built from the Genum source trees. */
export const catalogPackages: Product[] = ${JSON.stringify(packages, null, 2)};\n`;
// Format with the repo's prettier so re-runs produce no diff noise.
const { format } = await import("prettier");
const formatted = await format(out, { parser: "typescript", printWidth: 100 });
writeFileSync("lib/catalog-extras-data.ts", formatted);
console.log(`wrote ${models.length} models + ${packages.length} packages to lib/catalog-extras-data.ts`);
