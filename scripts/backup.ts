// =====================================================================
// scripts/backup.ts — a local, restorable snapshot of the shared project.
//
// The free plan has no point-in-time recovery: a bad migration or a mis-clicked
// delete is simply gone. This writes, under `backups/<timestamp>/` (gitignored):
//
//   tables/<table>.json   every row of every table declared in schema.sql
//   storage-manifest.json every Storage object with its size
//   images/<path>         the image bytes themselves (with --with-images)
//   manifest.json         counts, byte totals, and where the snapshot came from
//
//   npm run backup                    # tables + manifest (fast, small)
//   npm run backup -- --with-images   # also pull the product image files
//
// Tables are read with the service-role key over REST in 1000-row pages, so it
// works with nothing but the env vars already in .env.local.
// =====================================================================
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { createClient } from "@supabase/supabase-js";

const BUCKETS = ["product-images"] as const;
const PAGE = 1000;

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

/** Table names straight from schema.sql, so a new migration is covered for free. */
function tablesFromSchema(): string[] {
  const path = resolve(process.cwd(), "supabase/schema.sql");
  if (!existsSync(path)) throw new Error("supabase/schema.sql not found.");
  const text = readFileSync(path, "utf8");
  const names = new Set<string>();
  for (const match of text.matchAll(/create table if not exists public\.([a-z0-9_]+)/gi)) {
    const name = match[1];
    if (name) names.add(name);
  }
  return [...names].sort();
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

async function listObjects(db: StorageDb, bucket: string, prefix = ""): Promise<StorageEntry[]> {
  const out: StorageEntry[] = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await db.storage.from(bucket).list(prefix, { limit: 100, offset });
    if (error) throw new Error(`${bucket}/${prefix}: ${error.message}`);
    const page = (data ?? []) as StorageEntry[];
    for (const entry of page) {
      if (!entry.metadata && !entry.name.includes(".")) {
        out.push(
          ...(await listObjects(db, bucket, prefix ? `${prefix}/${entry.name}` : entry.name))
        );
        continue;
      }
      out.push({ ...entry, name: prefix ? `${prefix}/${entry.name}` : entry.name });
    }
    if (page.length < 100) break;
  }
  return out;
}

async function main() {
  loadEnv();
  const withImages = process.argv.includes("--with-images");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");

  const db = createClient(url, key, { auth: { persistSession: false } });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const root = resolve(process.cwd(), "backups", stamp);
  mkdirSync(join(root, "tables"), { recursive: true });

  const tables = tablesFromSchema();
  const counts: Record<string, number> = {};
  for (const table of tables) {
    const rows: unknown[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await db
        .from(table)
        .select("*")
        .range(from, from + PAGE - 1);
      if (error) {
        // A table that exists in schema.sql but not in the live project is a
        // real drift signal; record it instead of aborting the whole snapshot.
        counts[table] = -1;
        writeFileSync(
          join(root, "tables", `${table}.error.json`),
          JSON.stringify({ error: error.message }, null, 2)
        );
        break;
      }
      rows.push(...(data ?? []));
      if ((data ?? []).length < PAGE) break;
    }
    if (counts[table] === -1) continue;
    counts[table] = rows.length;
    writeFileSync(join(root, "tables", `${table}.json`), JSON.stringify(rows, null, 2));
  }

  const storage: Record<string, { count: number; bytes: number; objects: StorageEntry[] }> = {};
  for (const bucket of BUCKETS) {
    const objects = await listObjects(db, bucket);
    storage[bucket] = {
      count: objects.length,
      bytes: objects.reduce((sum, o) => sum + (o.metadata?.size ?? 0), 0),
      objects,
    };
    writeFileSync(join(root, "storage-manifest.json"), JSON.stringify(storage, null, 2));
    if (!withImages) continue;
    let saved = 0;
    for (const object of objects) {
      const { data, error } = await db.storage.from(bucket).download(object.name);
      if (error || !data) continue;
      const target = join(root, "images", bucket, object.name);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, Buffer.from(await data.arrayBuffer()));
      saved += 1;
    }
    console.log(`  ${bucket}: ${saved}/${objects.length} image files copied`);
  }

  const totalRows = Object.values(counts)
    .filter((n) => n >= 0)
    .reduce((a, b) => a + b, 0);
  writeFileSync(
    join(root, "manifest.json"),
    JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        project: url,
        tables: counts,
        totalRows,
        storage,
        withImages,
      },
      null,
      2
    )
  );

  const missing = Object.entries(counts)
    .filter(([, n]) => n < 0)
    .map(([t]) => t);
  console.log(
    `Backup written to backups/${stamp}: ${totalRows} rows across ${
      Object.keys(counts).length - missing.length
    } tables.`
  );
  if (missing.length) console.log(`  Tables missing from the live project: ${missing.join(", ")}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
