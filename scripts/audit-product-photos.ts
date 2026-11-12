// =====================================================================
// scripts/audit-product-photos.ts — list products that still need a real,
// distinct photo (placeholder or a copied shared-image stand-in).
//
//   npm run photos:audit                   # print report
//   npm run photos:audit -- --out docs/PHOTO_AUDIT.md
//
// "Own" copies created by the dedupe pass are named `<id>-own.*`; they are
// real objects but the same pixels as another product until replaced.
// =====================================================================
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvFile() {
  try {
    const raw = readFileSync(join(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (!match?.[1]) continue;
      const value = (match[2] || "").replace(/^["']|["']$/g, "");
      if (!process.env[match[1]]) process.env[match[1]] = value;
    }
  } catch {}
}

function argValue(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return null;
  const next = process.argv[i + 1];
  return next && !next.startsWith("--") ? next : null;
}

type Row = {
  id: string;
  name: string;
  sku: string | null;
  category: string | null;
  image_url: string | null;
  active: boolean;
  stock: number | null;
};

function classify(imageUrl: string | null): "placeholder" | "copied-shared" | "ok" | "missing" {
  if (!imageUrl) return "missing";
  const name = imageUrl.split("/").pop() || "";
  if (/placeholder/i.test(name)) return "placeholder";
  if (/-own\.[a-z0-9]+$/i.test(name)) return "copied-shared";
  return "ok";
}

async function main() {
  loadEnvFile();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }
  const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await db
    .from("products")
    .select("id, name, sku, category, image_url, active, stock")
    .order("active", { ascending: false })
    .order("name", { ascending: true });
  if (error) {
    console.error(error.message);
    process.exit(1);
  }
  const rows = (data || []) as Row[];
  const placeholder = rows.filter((r) => classify(r.image_url) === "placeholder");
  const copied = rows.filter((r) => classify(r.image_url) === "copied-shared");
  const missing = rows.filter((r) => classify(r.image_url) === "missing");

  const lines: string[] = [];
  lines.push("# Product photo audit");
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString().slice(0, 10)}`);
  lines.push("");
  lines.push(
    "Products that need a real, distinct photo. **Placeholder** = no real shot yet (shows the generic placeholder). **Copied shared image** = has its own storage object/reference but it is a pixel-copy of a photo another product used to share; replace with a real shot of this product."
  );
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`| Status | Count |`);
  lines.push(`| --- | ---: |`);
  lines.push(`| Placeholder | ${placeholder.length} |`);
  lines.push(`| Copied shared image (needs real shot) | ${copied.length} |`);
  lines.push(`| Missing image_url | ${missing.length} |`);
  lines.push(
    `| Total needing attention | ${placeholder.length + copied.length + missing.length} |`
  );
  lines.push("");

  function section(title: string, items: Row[], kind: string) {
    lines.push(`## ${title} (${items.length})`);
    lines.push("");
    if (!items.length) {
      lines.push("_None._");
      lines.push("");
      return;
    }
    lines.push("| Priority | Product | ID | Category | Active | Stock | Image |");
    lines.push("| --- | --- | --- | --- | --- | ---: | --- |");
    items.forEach((r, i) => {
      const img = (r.image_url || "").split("/").pop() || "(none)";
      const active = r.active ? "yes" : "no";
      const pr = r.active ? (kind === "placeholder" ? "High" : "Medium") : "Low";
      lines.push(
        `| ${pr} ${i + 1} | ${r.name.replace(/\|/g, "/")} | \`${r.id}\` | ${r.category || ""} | ${active} | ${r.stock ?? ""} | \`${img}\` |`
      );
    });
    lines.push("");
  }

  // prioritize active items
  const byPri = (a: Row, b: Row) =>
    Number(b.active) - Number(a.active) || a.name.localeCompare(b.name);
  section("Placeholder image", [...placeholder].sort(byPri), "placeholder");
  section("Copied shared image (replace with real photo)", [...copied].sort(byPri), "copied");
  if (missing.length) section("Missing image_url", [...missing].sort(byPri), "missing");

  lines.push("## How to fix");
  lines.push("");
  lines.push(
    "- Upload/replace the product image in the admin panel (or storage) with a real photo of that specific product, then re-run `npm run images:verify` and `npm run photos:audit`."
  );
  lines.push("- Prioritize **active, in-stock** products shown as High/Medium above.");
  lines.push("");

  const report = lines.join("\n");
  const out = argValue("out");
  if (out) {
    writeFileSync(join(process.cwd(), out), report, "utf8");
    console.log(
      `Wrote ${out} (${placeholder.length} placeholder, ${copied.length} copied, ${missing.length} missing).`
    );
  } else {
    console.log(report);
  }
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
