#!/usr/bin/env node
// =====================================================================
// health-check.mjs — guardrail check for the free tier and catalog.
// Runs limits, images:verify, and catalog:dupes and fails on problems
// that can take the site offline or corrupt the catalog.
//
//   npm run health:check
//
// Requires the same env/creds as the underlying scripts (live DB/storage).
// Use --skip-limits if SUPABASE_ACCESS_TOKEN is unavailable.
// =====================================================================
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const skipLimits = args.includes("--skip-limits");
const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";

function run(label, scriptArgs) {
  console.log(`\n=== ${label} ===`);
  const r = spawnSync(npmCmd, ["run", ...scriptArgs], {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: process.env,
  });
  const code = r.status ?? (r.error ? 1 : 0);
  if (r.error) console.error(r.error.message);
  return code;
}

let failed = false;

// 1) limits — live usage. May need SUPABASE_ACCESS_TOKEN; treat missing token as a warning skip.
if (skipLimits) {
  console.log("\n=== limits (skipped: --skip-limits) ===");
} else if (!process.env.SUPABASE_ACCESS_TOKEN) {
  // try loading .env.local quickly
  try {
    const { readFileSync } = await import("node:fs");
    const raw = readFileSync(".env.local", "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = /^([A-Z0-9_]+)=(.*)$/.exec(line);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
    }
  } catch {}
  if (!process.env.SUPABASE_ACCESS_TOKEN) {
    console.log("\n=== limits (skipped: SUPABASE_ACCESS_TOKEN not set) ===");
  } else {
    const code = run("limits", ["limits"]);
    if (code !== 0) {
      console.error("limits failed.");
      failed = true;
    }
  }
} else {
  const code = run("limits", ["limits"]);
  if (code !== 0) {
    console.error("limits failed.");
    failed = true;
  }
}

// 2) images:verify — exits non-zero on missing references (and reports over-budget/unused)
const vCode = run("images:verify", ["images:verify"]);
if (vCode !== 0) {
  console.error("images:verify failed (missing image references).");
  failed = true;
}

// 3) catalog:dupes --strict — exits non-zero on SKU/photo/test-residue warnings or active name duplicates
const dCode = run("catalog:dupes (strict)", ["catalog:dupes", "--", "--strict"]);
if (dCode !== 0) {
  console.error("catalog:dupes reported actionable issues.");
  failed = true;
}

console.log("\n=== health:check summary ===");
if (failed) {
  console.error("FAILED — fix the issues above (missing refs, collisions, or script errors).");
  process.exit(1);
}
console.log("OK — no missing image references and no actionable catalog collisions.");
process.exit(0);
