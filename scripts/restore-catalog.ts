// =====================================================================
// restore-catalog.ts — bring back the catalog rows the September rebuild
// dropped, from the only copy that survived: the git snapshot.
//
// History: the U-13 inventory rewrite (commit e602959, 2026-09-23) replaced
// 173 old rows with the 55-item sellable inventory. The old title images had
// already pushed the free-tier bucket to 23.6 MB, and the original project
// (bkylfnlybtsujwzropru) has since been deleted — its host no longer resolves,
// so the database itself is gone. Two copies survived:
//
//   backups/catalog-lost-2026-09-23.json   product data, extracted from
//                                          `git show e602959^:lib/catalog-data.ts`
//   public/media/products/*.jpg            the original photos (5.2 MB)
//
// This script re-inserts the missing rows, re-encoding each local photo through
// lib/image-budget.ts first, so restoring 29 photos costs ~3 MB of Storage
// instead of the ~23 MB that broke the free tier. Nothing is overwritten: an id
// that already exists in `products` is skipped, so the script is safe to re-run.
//
//   npm run catalog:restore             # dry run: what would be inserted
//   npm run catalog:restore -- --apply  # upload images + insert rows
//
// The snapshot also carries 20 Excel-import project kits whose price is a
// combined "cost / hours" figure. They are printed but never inserted: a
// product without a real price must not reach the storefront.
// =====================================================================
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

import { optimizeImage } from "../lib/image-budget";
import { formatBytes } from "../lib/image-limits";

const SNAPSHOT = join(process.cwd(), "data", "catalog-lost-2026-09-23.json");
const MEDIA_DIR = join(process.cwd(), "public", "media", "products");
const BUCKET = "product-images";
const apply = process.argv.includes("--apply");
const healOnly = process.argv.includes("--heal-images");

type SnapshotProduct = {
  id: string;
  name: string;
  category: string;
  projectCategory: string | null;
  price: number;
  priceLabel: string;
  sku: string;
  productType: string;
  inventoryType: string;
  note: string;
  description: string;
  specs: string[];
  stock: number;
  color: string;
  badge: string | null;
  image: string | null;
  carModeId: string | null;
};

type Snapshot = {
  createdAt: string;
  source: string;
  products: SnapshotProduct[];
  notRestored?: { reason: string; items: { id: string; name: string }[] };
};

function loadEnvFile() {
  try {
    const raw = readFileSync(join(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (!match?.[1]) continue;
      const key = match[1];
      const value = (match[2] || "").replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // Fall back to already-set environment variables.
  }
}

function mediaFile(image: string | null): string | null {
  if (!image || !image.startsWith("/media/products/")) return null;
  const name = image.split("/").pop();
  return name ? join(MEDIA_DIR, name) : null;
}

/**
 * Repoint products whose image_url names a file the bucket no longer has.
 *
 * Restoring a row also restores the URL it pointed at — and the rebuild deleted
 * objects as well as rows, so 43 products referenced files that were gone. Three
 * sources are tried, cheapest first: an object with the same stem and a different
 * extension (the old `.jpg` vs the re-encoded `.webp`), the surviving original in
 * `public/media/products`, and finally nothing — the card keeps its category
 * artwork and `images:verify` still lists the row.
 */
async function healImages(db: any, storageBase: string, bucket: string) {
  const { data: objects, error } = await db.storage.from(bucket).list("", { limit: 1000 });
  if (error) {
    console.error("Could not list the bucket:", error.message);
    return;
  }
  const names = new Set<string>((objects ?? []).map((object: { name: string }) => object.name));
  const { data: rows, error: readError } = await db
    .from("products")
    .select("id, image_url")
    .not("image_url", "is", null);
  if (readError) {
    console.error("Could not read products:", readError.message);
    return;
  }

  let repointed = 0;
  // Galleries referenced deleted objects too (the Shiva statue kept a dead
  // placeholder + linkimport pair). Prune them in the same pass so
  // `images:verify` is honest about what is actually broken.
  const { data: galleryRows } = await db
    .from("products")
    .select("id, gallery")
    .not("gallery", "is", null);
  for (const row of galleryRows ?? []) {
    const gallery = Array.isArray(row.gallery) ? (row.gallery as string[]) : [];
    const kept = gallery.filter((entry) => names.has(entry.split("/").pop() || ""));
    if (kept.length === gallery.length) continue;
    console.log(`  gallery ${row.id}: ${gallery.length} → ${kept.length}`);
    if (apply) {
      const { error: galleryError } = await db
        .from("products")
        .update({ gallery: kept })
        .eq("id", row.id);
      if (galleryError) console.warn(`    gallery update failed: ${galleryError.message}`);
    }
  }

  for (const row of rows ?? []) {
    const current = String(row.image_url);
    const currentName = current.split("/").pop() || "";
    if (!currentName || names.has(currentName)) continue;
    const stem = currentName.replace(/\.[a-z0-9]+$/i, "");
    const sameStem = [...names].find((name) => name.replace(/\.[a-z0-9]+$/i, "") === stem);
    let replacement = sameStem
      ? `${storageBase}/storage/v1/object/public/${bucket}/${sameStem}`
      : null;

    if (!replacement) {
      for (const ext of ["jpg", "jpeg", "png", "webp"]) {
        const local = join(MEDIA_DIR, `${row.id}.${ext}`);
        if (!existsSync(local)) continue;
        const optimized = await optimizeImage(readFileSync(local));
        const objectName = `${row.id}.${optimized.extension}`;
        console.log(`  upload ${objectName.padEnd(32)} ${formatBytes(optimized.bytes.byteLength)}`);
        if (apply) {
          const { error: uploadError } = await db.storage
            .from(bucket)
            .upload(objectName, optimized.bytes, {
              contentType: optimized.contentType,
              cacheControl: "31536000",
              upsert: true,
            });
          if (uploadError) {
            console.warn(`    upload failed: ${uploadError.message}`);
            continue;
          }
        }
        names.add(objectName);
        replacement = `${storageBase}/storage/v1/object/public/${bucket}/${objectName}`;
        break;
      }
    }

    // Nothing with that stem survived: fall back to the protected placeholder
    // rather than leaving a 404 on the storefront.
    if (!replacement && names.has("genum-product-placeholder.webp")) {
      replacement = `${storageBase}/storage/v1/object/public/${bucket}/genum-product-placeholder.webp`;
    }
    if (!replacement) {
      console.log(`  no source for ${row.id} (${currentName})`);
      continue;
    }
    console.log(`  ${row.id.padEnd(30)} ${currentName} → ${replacement.split("/").pop()}`);
    if (apply) {
      const { error: updateError } = await db
        .from("products")
        .update({ image_url: replacement })
        .eq("id", row.id);
      if (updateError) console.warn(`    update failed: ${updateError.message}`);
      else repointed += 1;
    }
  }

  console.log(
    apply
      ? `\nHealed ${repointed} product image reference(s).`
      : "\nDry run only. Re-run with --apply to repoint these images."
  );
}

async function main() {
  loadEnvFile();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Add them to .env.local first."
    );
    process.exit(1);
  }
  if (!existsSync(SNAPSHOT)) {
    console.error(`No snapshot at ${SNAPSHOT}.`);
    process.exit(1);
  }

  const db = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const storageBase = url.replace(/\/+$/, "");

  if (healOnly) {
    await healImages(db, storageBase, BUCKET);
    return;
  }

  const snapshot = JSON.parse(readFileSync(SNAPSHOT, "utf8")) as Snapshot;
  const { data: existing, error } = await db.from("products").select("id");
  if (error) {
    console.error("Could not read the products table:", error.message);
    process.exit(1);
  }
  const present = new Set((existing ?? []).map((row) => row.id as string));
  const missing = snapshot.products.filter((product) => !present.has(product.id));

  console.log(`Snapshot: ${snapshot.products.length} products (${snapshot.source})`);
  console.log(`Already in the database: ${snapshot.products.length - missing.length}`);
  console.log(`${apply ? "Restoring" : "Would restore"}: ${missing.length}\n`);

  let uploaded = 0;
  let storedBytes = 0;

  for (const product of missing) {
    const file = mediaFile(product.image);
    let imageUrl: string | null = null;

    if (file && existsSync(file)) {
      const original = readFileSync(file);
      const optimized = await optimizeImage(original);
      const objectName = `${product.id}.${optimized.extension}`;
      imageUrl = `${storageBase}/storage/v1/object/public/${BUCKET}/${objectName}`;
      console.log(
        `  image ${objectName.padEnd(34)} ${formatBytes(optimized.originalBytes)} → ${formatBytes(
          optimized.bytes.byteLength
        )}`
      );
      if (apply) {
        const { error: uploadError } = await db.storage
          .from(BUCKET)
          .upload(objectName, optimized.bytes, {
            contentType: optimized.contentType,
            cacheControl: "31536000",
            upsert: true,
          });
        // A failed image must not block the row: the card falls back to the
        // category artwork, and images:verify will list it afterwards.
        if (uploadError) console.warn(`    upload failed: ${uploadError.message}`);
        else {
          uploaded += 1;
          storedBytes += optimized.bytes.byteLength;
        }
      }
    }

    const isPackage = product.productType === "Project package";
    const row = {
      id: product.id,
      name: product.name,
      category: product.category,
      project_category: product.projectCategory,
      price: product.price,
      price_label: product.priceLabel,
      sku: product.sku,
      product_type: product.productType,
      inventory_type: product.inventoryType,
      active: true,
      note: product.note,
      description: product.description,
      specs: product.specs,
      stock: product.stock,
      delivery: isPackage
        ? "Kit contents and lead time confirmed with quotation"
        : "Ships in 1–2 working days",
      color: product.color,
      badge: product.badge,
      image_url: imageUrl,
      car_mode_id: product.carModeId,
      sort_order: isPackage ? 900 : 1000,
    };

    if (apply) {
      const { error: insertError } = await db.from("products").insert(row);
      if (insertError) console.warn(`  ! ${product.id}: ${insertError.message}`);
    }
  }

  if (snapshot.notRestored?.items.length) {
    console.log(
      `\nLeft for owner review (${snapshot.notRestored.items.length}): ${snapshot.notRestored.reason}`
    );
    for (const item of snapshot.notRestored.items) console.log(`  ${item.id} — ${item.name}`);
  }

  if (!apply) {
    console.log("\nDry run only. Re-run with --apply to upload the images and insert the rows.");
    return;
  }
  console.log(
    `\nDone. Inserted ${missing.length} rows, uploaded ${uploaded} images (${formatBytes(
      storedBytes
    )} of Storage).`
  );
  console.log("Next: `npm run images:verify` and `npm run limits`.");
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
