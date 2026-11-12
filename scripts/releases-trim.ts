// =====================================================================
// scripts/releases-trim.ts — keep app-releases lean on the free tier.
//
// Retention rule: keep release.json, genum-solutions-latest.apk, the
// versioned APK named by release.json (current), and ONE previous
// versioned APK. Delete every other object in the bucket.
//
//   npm run releases:trim                  # dry run (default)
//   npm run releases:trim -- --apply       # remove old builds
//
// Reads release.json from the bucket to identify the current build; if
// it cannot be read, the script refuses to delete anything.
// =====================================================================
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "app-releases";
const apply = process.argv.includes("--apply");

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
    // fall back to process env
  }
}

function parseVersion(name: string): number[] | null {
  const m = name.match(/(\d+)\.(\d+)\.(\d+)/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function cmpVersion(a: number[], b: number[]) {
  for (let i = 0; i < 3; i += 1) {
    const d = (a[i] || 0) - (b[i] || 0);
    if (d !== 0) return d;
  }
  return 0;
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

  const { data: releaseBlob, error: relErr } = await db.storage
    .from(BUCKET)
    .download("release.json");
  if (relErr || !releaseBlob) {
    console.error(
      "Cannot read release.json from bucket; refusing to delete anything.",
      relErr?.message ?? ""
    );
    process.exit(1);
  }
  let release: { apkUrl?: string; latestApkUrl?: string; version?: string };
  try {
    release = JSON.parse(await releaseBlob.text()) as typeof release;
  } catch (e) {
    console.error("release.json is not valid JSON; refusing to delete anything.");
    process.exit(1);
  }
  const currentApk =
    String(release.apkUrl || "")
      .split("/")
      .pop() || "";
  if (!currentApk) {
    console.error("release.json has no apkUrl; refusing to delete anything.");
    process.exit(1);
  }

  const { data: objects, error: listErr } = await db.storage.from(BUCKET).list("", { limit: 200 });
  if (listErr || !objects) {
    console.error("Could not list bucket:", listErr?.message);
    process.exit(1);
  }

  const versioned = objects
    .map((o) => o.name)
    .filter((n) => /^genum-solutions-\d+\.\d+\.\d+\.apk$/i.test(n));
  const byVer = versioned
    .map((name) => ({ name, ver: parseVersion(name)! }))
    .sort((a, b) => cmpVersion(b.ver, a.ver));

  const keep = new Set<string>(["release.json", "genum-solutions-latest.apk", currentApk]);
  // one previous build: first versioned APK that is not the current one
  const previous = byVer.find((v) => v.name !== currentApk);
  if (previous) keep.add(previous.name);

  const names = objects.map((o) => o.name);
  const remove = names.filter((n) => !keep.has(n));
  const unknown = remove.filter((n) => !/^genum-solutions-\d+\.\d+\.\d+\.apk$/i.test(n));
  if (unknown.length) {
    console.warn("Note: non-release objects present (kept):", unknown.join(", "));
  }
  const toDelete = remove.filter((n) => /^genum-solutions-\d+\.\d+\.\d+\.apk$/i.test(n));

  console.log(`Current (from release.json ${release.version ?? "?"}): ${currentApk}`);
  console.log(`Keep: ${[...keep].sort().join(", ")}`);
  if (toDelete.length === 0) {
    console.log("Nothing to remove. Bucket already follows the retention rule.");
    return;
  }
  console.log(`${apply ? "Deleting" : "Would delete"}: ${toDelete.join(", ")}`);
  if (!apply) {
    console.log("Dry run. Re-run with --apply to remove them.");
    return;
  }
  const { error: rmErr } = await db.storage.from(BUCKET).remove(toDelete);
  if (rmErr) {
    console.error("Delete failed:", rmErr.message);
    process.exit(1);
  }
  console.log(`Removed ${toDelete.length} old build(s).`);
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
