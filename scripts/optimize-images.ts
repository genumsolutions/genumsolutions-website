// =====================================================================
// scripts/optimize-images.ts — bring the `product-images` bucket back under
// the shared image budget (lib/image-budget.ts).
//
// Every image uploaded before the budget existed was stored exactly as the
// source CDN served it, so the bucket averaged ~754 KB per photo. This walks
// the bucket, re-encodes anything over budget to WebP at ≤1600px, repoints
// the products rows that referenced the old file, and deletes the original.
//
//   npm run images:optimize -- --dry-run      # measure only, change nothing
//   npm run images:optimize                   # apply
//   npm run images:optimize -- --limit 10     # bounded batch (free-tier safe)
//
// Deleting the original only happens after the new URL is written to every
// products row that referenced it, so a failure mid-run leaves the site
// serving the pre-existing file rather than a broken image.
// =====================================================================
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createClient } from "@supabase/supabase-js";

import { formatBytes, IMAGE_BUDGET, optimizeImage } from "../lib/image-budget";

const BUCKET = "product-images";

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    const path = resolve(process.cwd(), file);
    if (!existsSync(path)) continue;
    const text = readFileSync(path, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!match) continue;
      const key = match[1];
      const value = (match[2] ?? "").replace(/^["']|["']$/g, "");
      if (key && !process.env[key]) process.env[key] = value;
    }
  }
}

function argValue(name: string): string | null {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return null;
  const next = process.argv[index + 1];
  return next && !next.startsWith("--") ? next : "";
}

type StorageEntry = { name: string; metadata?: { size?: number } | null };

/** Only the slice of the storage client this script touches. */
type StorageDb = {
  storage: {
    from(bucket: string): {
      list(
        path: string,
        options: { limit: number; offset: number }
      ): Promise<{ data: unknown; error: { message: string } | null }>;
    };
  };
};

async function listAll(db: StorageDb, prefix = ""): Promise<StorageEntry[]> {
  const out: StorageEntry[] = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await db.storage.from(BUCKET).list(prefix, { limit: 100, offset });
    if (error) throw new Error(error.message);
    const page = (data ?? []) as StorageEntry[];
    for (const entry of page) {
      // Folders come back with a null id and no metadata; recurse into them.
      if (!entry.metadata && !entry.name.includes(".")) {
        out.push(...(await listAll(db, prefix ? `${prefix}/${entry.name}` : entry.name)));
        continue;
      }
      out.push({ ...entry, name: prefix ? `${prefix}/${entry.name}` : entry.name });
    }
    if (page.length < 100) break;
  }
  return out;
}

const publicUrlFor = (path: string) =>
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;

async function main() {
  loadEnv();
  const dryRun = process.argv.includes("--dry-run");
  const limitRaw = Number(argValue("limit") ?? 0);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.floor(limitRaw) : 0;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  const db = createClient(url, key, { auth: { persistSession: false } });

  const entries = (await listAll(db)).filter((e) => e.name && !e.name.endsWith("/"));
  const totalBytes = entries.reduce((sum, e) => sum + (e.metadata?.size ?? 0), 0);
  console.log(
    `${entries.length} objects, ${formatBytes(totalBytes)} stored` +
      ` (budget ${formatBytes(IMAGE_BUDGET.maxStoredBytes)}/image)${dryRun ? " — DRY RUN" : ""}`
  );

  // One read of the catalog so URL rewrites never need a per-image query.
  const { data: products, error: productsError } = await db
    .from("products")
    .select("id, image_url, gallery");
  if (productsError) throw new Error(productsError.message);
  const rows = (products ?? []) as {
    id: string;
    image_url: string | null;
    gallery: string[] | null;
  }[];
  const urlToNew = new Map<string, string>();

  let processed = 0;
  let optimized = 0;
  let beforeBytes = 0;
  let afterBytes = 0;
  const failures: string[] = [];

  for (const entry of entries) {
    if (limit && processed >= limit) break;
    const size = entry.metadata?.size ?? 0;
    // Already inside budget and already our format: nothing to gain.
    if (entry.name.endsWith(".webp") && size <= IMAGE_BUDGET.maxStoredBytes) continue;
    processed += 1;

    const oldUrl = publicUrlFor(entry.name);
    const { data: blob, error: downloadError } = await db.storage.from(BUCKET).download(entry.name);
    if (downloadError || !blob) {
      failures.push(`${entry.name}: download failed (${downloadError?.message ?? "empty"})`);
      continue;
    }
    let optimizedImage;
    try {
      optimizedImage = await optimizeImage(Buffer.from(await blob.arrayBuffer()));
    } catch (error) {
      failures.push(`${entry.name}: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }

    const saving = size - optimizedImage.bytes.byteLength;
    // Nothing worth rewriting: a small gain would just churn Storage.
    // Nothing worth rewriting: a small gain would just churn Storage.
    if (saving < 8 * 1024) continue;
    beforeBytes += size;
    afterBytes += optimizedImage.bytes.byteLength;
    console.log(
      `  ${dryRun ? "would fix" : "fix"} ${entry.name} ` +
        `${formatBytes(size)} -> ${formatBytes(optimizedImage.bytes.byteLength)} ` +
        `(${optimizedImage.width}x${optimizedImage.height} webp)`
    );
    optimized += 1;
    const newPath = `${entry.name.replace(/\.[a-z0-9]+$/i, "")}.webp`;
    const newUrl = publicUrlFor(newPath);

    if (dryRun) {
      urlToNew.set(oldUrl, newUrl);
      continue;
    }

    const { error: uploadError } = await db.storage
      .from(BUCKET)
      .upload(newPath, optimizedImage.bytes, {
        contentType: "image/webp",
        cacheControl: "31536000",
        upsert: true,
      });
    if (uploadError) {
      failures.push(`${entry.name}: upload failed (${uploadError.message})`);
      continue;
    }

    // Repoint every row BEFORE dropping the old object.
    const touched = rows.filter(
      (r) => r.image_url === oldUrl || (r.gallery ?? []).includes(oldUrl)
    );
    for (const row of touched) {
      const patch: Record<string, unknown> = {};
      if (row.image_url === oldUrl) patch.image_url = newUrl;
      if ((row.gallery ?? []).includes(oldUrl)) {
        patch.gallery = (row.gallery ?? []).map((g) => (g === oldUrl ? newUrl : g));
      }
      const { error: updateError } = await db.from("products").update(patch).eq("id", row.id);
      if (updateError) {
        failures.push(`${entry.name}: row ${row.id} update failed (${updateError.message})`);
      } else {
        row.image_url = (patch.image_url as string) ?? row.image_url;
        row.gallery = (patch.gallery as string[]) ?? row.gallery;
      }
    }
    if (newPath !== entry.name) {
      const { error: removeError } = await db.storage.from(BUCKET).remove([entry.name]);
      if (removeError)
        failures.push(`${entry.name}: could not delete original (${removeError.message})`);
    }
  }

  if (dryRun) {
    console.log(`\nWould reclaim ${formatBytes(beforeBytes - afterBytes)} (${optimized} images).`);
  } else {
    console.log(
      `\nReclaimed ${formatBytes(beforeBytes - afterBytes)} across ${optimized} images;` +
        ` ${processed} inspected.`
    );
  }
  if (failures.length) {
    console.log(`\n${failures.length} skipped:`);
    for (const line of failures.slice(0, 20)) console.log(`  - ${line}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
