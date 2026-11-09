// =====================================================================
// scripts/verify-images.ts — prove no product row points at a file that no
// longer exists, and report the bucket's total footprint against the budget.
//
//   npm run images:verify
//
// Run after images:optimize (or any bulk Storage change). Exits non-zero when
// a referenced image is missing, so a broken catalog cannot ship quietly.
// =====================================================================
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createClient } from "@supabase/supabase-js";

import { formatBytes, IMAGE_BUDGET } from "../lib/image-limits";

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

type StorageEntry = { name: string; metadata?: { size?: number } | null };

async function main() {
  loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars are required.");
  const db = createClient(url, key, { auth: { persistSession: false } });

  const { data: objects, error: listError } = await db.storage
    .from(BUCKET)
    .list("", { limit: 1000 });
  if (listError) throw new Error(listError.message);
  const entries = (objects ?? []) as StorageEntry[];
  const present = new Set(entries.map((e) => e.name));
  const bytes = entries.reduce((sum, e) => sum + (e.metadata?.size ?? 0), 0);

  const { data: products, error: productsError } = await db
    .from("products")
    .select("id, name, image_url, gallery");
  if (productsError) throw new Error(productsError.message);
  const rows = (products ?? []) as {
    id: string;
    name: string;
    image_url: string | null;
    gallery: string[] | null;
  }[];

  const missing: string[] = [];
  const oversized: string[] = [];
  const bySize = new Map(entries.map((e) => [e.name, e.metadata?.size ?? 0]));
  let referenced = 0;

  for (const row of rows) {
    const urls = [row.image_url, ...(row.gallery ?? [])].filter(
      (u): u is string => typeof u === "string" && u.includes(`/${BUCKET}/`)
    );
    for (const imageUrl of new Set(urls)) {
      referenced += 1;
      const name = decodeURIComponent(imageUrl.split(`/${BUCKET}/`)[1] ?? "");
      if (!present.has(name)) {
        missing.push(`${row.name || row.id}: ${name}`);
        continue;
      }
      if ((bySize.get(name) ?? 0) > IMAGE_BUDGET.maxStoredBytes)
        oversized.push(`${name} (${formatBytes(bySize.get(name) ?? 0)})`);
    }
  }

  const unused = entries.filter(
    (e) => !rows.some((r) => [r.image_url, ...(r.gallery ?? [])].some((u) => u?.endsWith(e.name)))
  );

  console.log(
    `${entries.length} objects, ${formatBytes(bytes)} stored, ${referenced} references checked.`
  );
  console.log(`  over budget : ${oversized.length}`);
  console.log(`  missing file: ${missing.length}`);
  console.log(`  unreferenced: ${unused.length}`);
  for (const line of missing.slice(0, 10)) console.log(`  MISSING ${line}`);
  for (const line of oversized.slice(0, 10)) console.log(`  OVER ${line}`);
  for (const entry of unused.slice(0, 10)) console.log(`  UNUSED ${entry.name}`);
  if (missing.length) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
