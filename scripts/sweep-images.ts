// =====================================================================
// scripts/sweep-images.ts — delete `product-images` objects that no row in
// the database references any more.
//
//   npm run images:sweep                       # dry run (default, no writes)
//   npm run images:sweep -- --delete           # actually remove them
//   npm run images:sweep -- --keep-hours 48    # wider grace window
//   npm run images:sweep -- --limit 20         # cap deletions per run
//
// Why this is a separate command from images:optimize: that one rewrites files
// a row still uses, this one removes files nothing uses. Getting it wrong means
// a broken image, so the default is a dry run, and the scan fails closed:
//
//   • the reference scan reads EVERY table PostgREST exposes (39 today) rather
//     than a hand-written list — a new content table is covered automatically;
//   • if any table read fails, or the scan finds no references at all while
//     the bucket has objects, nothing is deleted;
//   • an object is kept if its exact path or its bare file name appears in any
//     row, if it changed within the grace window, or if it is protected.
//
// Reference extraction and the keep/delete judgement live in lib/image-sweep.ts
// so they are unit-tested without touching live data.
// =====================================================================
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createClient } from "@supabase/supabase-js";

import { formatBytes } from "../lib/image-limits";
import { extractObjectPaths, planSweep, summarizeKept, type SweepObject } from "../lib/image-sweep";

const BUCKET = "product-images";
/** Never delete these, whatever the catalog says. */
const PROTECTED = ["genum-product-placeholder.webp"];

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

type StorageEntry = {
  name: string;
  metadata?: { size?: number; lastModified?: string } | null;
};

/** Only the slice of the storage client this script touches. */
type StorageDb = {
  storage: {
    from(bucket: string): {
      list(
        path: string,
        options: { limit: number; offset: number }
      ): Promise<{ data: unknown; error: { message: string } | null }>;
      remove(paths: string[]): Promise<{ error: { message: string } | null }>;
    };
  };
};

/** Walk the bucket recursively; folders come back as entries without metadata. */
async function listAll(db: StorageDb, prefix = ""): Promise<StorageEntry[]> {
  const out: StorageEntry[] = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await db.storage.from(BUCKET).list(prefix, { limit: 100, offset });
    if (error) throw new Error(error.message);
    const page = (data ?? []) as StorageEntry[];
    for (const entry of page) {
      const full = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (!entry.metadata) {
        if (!entry.name.includes(".")) out.push(...(await listAll(db, full)));
        continue;
      }
      out.push({ ...entry, name: full });
    }
    if (page.length < 100) break;
  }
  return out;
}

type Row = Record<string, unknown>;

/** Only the slice of the query client this scan uses. */
type TableDb = {
  from(table: string): {
    select(columns: string): {
      range(
        from: number,
        to: number
      ): PromiseLike<{ data: unknown; error: { message: string } | null }>;
    };
  };
};

/**
 * Read every exposed table and return (a) the `product-images` paths found and
 * (b) each row as text for the bare-name check. Throws on the first failed read
 * so a partial scan can never be mistaken for a complete one.
 */
async function scanCatalog(
  db: TableDb
): Promise<{ paths: Set<string>; haystack: string[]; rows: number; tables: number }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const specResponse = await fetch(`${url}/rest/v1/`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!specResponse.ok) throw new Error(`Could not read the API schema (${specResponse.status}).`);
  const spec = (await specResponse.json()) as {
    definitions?: Record<string, { properties?: Record<string, unknown> }>;
  };
  const tables = Object.entries(spec.definitions ?? {})
    .filter(([, definition]) => Boolean(definition?.properties))
    .map(([name]) => name)
    .sort();
  if (tables.length === 0) throw new Error("The API schema listed no tables; refusing to guess.");

  const paths = new Set<string>();
  const haystack: string[] = [];
  let rows = 0;

  for (const table of tables) {
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db
        .from(table)
        .select("*")
        .range(from, from + 999);
      if (error) throw new Error(`Reading ${table} failed: ${error.message}`);
      const page = (data ?? []) as Row[];
      for (const row of page) {
        const text = JSON.stringify(row);
        haystack.push(text);
        for (const path of extractObjectPaths(text, BUCKET)) paths.add(path);
      }
      rows += page.length;
      if (page.length < 1000) break;
    }
  }
  return { paths, haystack, rows, tables: tables.length };
}

async function main() {
  loadEnv();
  const shouldDelete = process.argv.includes("--delete");
  const dryRun = !shouldDelete;
  const keepHoursRaw = Number(argValue("keep-hours") ?? 24);
  const keepHours = Number.isFinite(keepHoursRaw) && keepHoursRaw >= 0 ? keepHoursRaw : 24;
  const limitRaw = Number(argValue("limit") ?? 0);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.floor(limitRaw) : 0;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  const db = createClient(url, key, { auth: { persistSession: false } });

  const entries = (await listAll(db)).filter((e) => e.name && !e.name.endsWith("/"));
  const objects: SweepObject[] = entries.map((entry) => ({
    name: entry.name,
    size: entry.metadata?.size ?? 0,
    lastModified: entry.metadata?.lastModified ?? null,
  }));
  const storedBytes = objects.reduce((sum, o) => sum + o.size, 0);

  const { paths, haystack, rows, tables } = await scanCatalog(db);
  if (objects.length > 0 && paths.size === 0) {
    throw new Error(
      `Scanned ${rows} rows in ${tables} tables and found no ${BUCKET} references — ` +
        "that means the scan is broken, not that every image is unused. Deleting nothing."
    );
  }

  const plan = planSweep({
    objects,
    referencedPaths: paths,
    haystack,
    protect: PROTECTED,
    keepHours,
  });
  const kept = summarizeKept(plan.kept);

  console.log(
    `${BUCKET}: ${objects.length} objects, ${formatBytes(storedBytes)} stored` +
      (dryRun ? " — DRY RUN, nothing will be deleted" : " — DELETING")
  );
  console.log(`  catalog   : ${rows} rows across ${tables} tables, ${paths.size} paths referenced`);
  console.log(
    `  kept      : ${plan.kept.length}` +
      ` (${kept.referenced} referenced, ${kept["referenced-by-name"]} by name,` +
      ` ${kept.recent} newer than ${keepHours}h, ${kept.protected} protected)`
  );
  console.log(
    `  unused    : ${plan.unused.length} (${formatBytes(plan.reclaimableBytes)} reclaimable)`
  );

  const targets = limit ? plan.unused.slice(0, limit) : plan.unused;
  for (const object of targets) {
    console.log(
      `    ${dryRun ? "would delete" : "delete"} ${object.name} ` +
        `(${formatBytes(object.size)}, modified ${object.lastModified ?? "unknown"})`
    );
  }
  if (limit && plan.unused.length > limit)
    console.log(`  (--limit ${limit}: ${plan.unused.length - limit} left for the next run)`);

  if (dryRun) {
    console.log(`\nNothing changed. Re-run with --delete to remove ${targets.length} object(s).`);
    return;
  }
  if (targets.length === 0) {
    console.log("\nNothing to remove.");
    return;
  }

  let removed = 0;
  let reclaimed = 0;
  const failures: string[] = [];
  // Storage removes in batches; 100 keeps each request small.
  for (let index = 0; index < targets.length; index += 100) {
    const batch = targets.slice(index, index + 100);
    const { error } = await db.storage.from(BUCKET).remove(batch.map((o) => o.name));
    if (error) {
      failures.push(`${batch.map((o) => o.name).join(", ")}: ${error.message}`);
      continue;
    }
    for (const object of batch) {
      removed += 1;
      reclaimed += object.size;
    }
  }

  console.log(`\nRemoved ${removed} object(s), reclaimed ${formatBytes(reclaimed)}.`);
  if (failures.length) {
    console.log(`${failures.length} batch(es) failed:`);
    for (const line of failures) console.log(`  - ${line}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
