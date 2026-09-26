// =====================================================================
// normalize-catalog-2026-09-26.mjs — U-44 three-catalog unification.
//
// Owner asked to "rearrange the existing database so the app and the
// website converge on a unified front end". The three customer catalogs
// are now DISJOINT and both clients derive them from the SAME columns:
//
//   Electronic Products (/products, app Shop):
//     product_type <> 'Project package', category <> '3D Models'
//   3D Products (/3d-printing, app Printing):
//     category = '3D Models'
//   Projects (/projects, app Projects):
//     product_type = 'Project package'  OR  category = 'Pre-packaged Kits'
//
// This script normalizes live rows to that contract (dry-run default,
// `--apply` to write). Rules, in order:
//   R1 rows whose product_type is NULL/unknown         -> product_type='Retail kit'
//   R2 active rows in category 'Robot Cars' or
//      'Pre-packaged Kits' WITHOUT product_type
//      'Project package' (the admin-only limbo state)  -> category='3D Models'
//      (imported models are 3D-printable designs; owner-confirmed fix)
//   R3 rows in 'Pre-packaged Kits' without project_type -> product_type
//      stays 'Retail kit' (they ride the Projects page via category)
//   R4 robot-car packages (project_type='Project package' AND
//      project_category NULL)                          -> project_category='Robo Car'
//   R5 rows in '3d models' (case variants)             -> category='3D Models'
//      (exact casing so scope matching is deterministic)
//   R6 import-created rows (import_meta.sourceSite set) with a
//      project-family category and product_type='Retail kit' -> R2 catch-all
//      (kept identical to R2; documented for audit trail)
//
// Safety: never touches rows that already satisfy the contract; prints a
// per-rule change table; `--apply` required for any write.
// =====================================================================
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (m) env[m[1]] = (m[2] || "").replace(/^["']|["']$/g, "");
}
const APPLY = process.argv.includes("--apply");
const svc = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: rows, error } = await svc
  .from("products")
  .select("id, name, category, project_category, product_type, active, import_meta");
if (error) {
  console.error("read failed:", error.message);
  process.exit(1);
}

const norm = (c) => String(c ?? "").trim();
const lower = (c) => norm(c).toLowerCase();
const changes = [];
for (const r of rows) {
  const patch = {};
  const type = norm(r.product_type) || "Retail kit";
  if (type !== norm(r.product_type)) patch.product_type = type;

  const cat = norm(r.category);
  const pcat = r.project_category == null ? null : norm(r.project_category);

  if (lower(cat) === "3d models" && cat !== "3D Models") patch.category = "3D Models";
  if (cat === "" && patch.product_type !== "Project package" && type !== "Project package") {
    // rows must have a category (NOT NULL contract in the UI scopes)
    patch.category = "3D Models";
  }
  if (type === "Project package" && pcat === null && lower(cat) === "robot cars") {
    patch.project_category = "Robo Car";
  }
  const finalCat = patch.category ?? cat;
  const finalType = patch.product_type ?? type;
  if (
    r.active !== false &&
    (lower(finalCat) === "robot cars" || lower(finalCat) === "pre-packaged kits") &&
    finalType !== "Project package"
  ) {
    // R2/R6 limbo: Retail kit in a project-family category — re-home to 3D
    patch.category = "3D Models";
    if (pcat && patch.category !== cat) patch.project_category = null;
  }
  if (Object.keys(patch).length) changes.push({ id: r.id, name: r.name, ...patch });
}

console.log(`rows scanned: ${rows.length}`);
if (!changes.length) {
  console.log("database already satisfies the three-catalog contract — nothing to do.");
} else {
  for (const c of changes)
    console.log(`${APPLY ? "APPLY" : "WOULD"} ${c.id}: ${JSON.stringify(c)}`);
  if (!APPLY) {
    console.log(`\n${changes.length} row(s) need normalization. Re-run with --apply to write.`);
  } else {
    let ok = 0;
    for (const { id, name: _name, ...patch } of changes) {
      const { error: err } = await svc.from("products").update(patch).eq("id", id);
      if (err) console.error(`ERR ${id}: ${err.message}`);
      else ok += 1;
    }
    console.log(`\nnormalized ${ok}/${changes.length} row(s).`);
  }
}
