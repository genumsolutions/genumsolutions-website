import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// =====================================================================
// Dim-theme coverage guard (W-6).
//
// The website's dark theme is a class-override layer in globals.css
// (`html[data-theme='dim'] .…`). That layer is only as good as its
// coverage: any NEW color-carrying utility a component starts using
// (e.g. `bg-emerald-200`) without a dim override renders as a light
// chip in dark mode. This guard walks app/ + components/, extracts
// Tailwind color utilities from className literals, and fails when a
// used utility has no dim rule — so drift is caught in CI, not by the
// owner's eyes during the P3 review.
// =====================================================================

const ROOT = resolveRepoRoot();
const SOURCE_DIRS = [join(ROOT, "app"), join(ROOT, "components")];
const GLOBALS_CSS = readFileSync(join(ROOT, "app", "globals.css"), "utf8");

function resolveRepoRoot(): string {
  // tests/ lives directly under the repo root.
  return join(import.meta.dirname, "..");
}

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules" || entry === ".next") continue;
      walk(full, files);
    } else if (/\.(tsx|ts)$/.test(entry)) {
      files.push(full);
    }
  }
  return files;
}

// Tailwind color utilities worth guarding (backgrounds, text, borders).
const COLOR_UTILITY =
  /\b(?:bg|text|border|divide|ring|from|via|to)-(?:white|black|(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950))\b/g;

// Utilities that are SAFE in dim mode without an override: they sit on
// already-dark contexts (navy/ink panels, status dots) or are mid-tone
// accents that keep contrast on both themes. Everything else that carries
// color must have a dim override. Extend ONLY with a comment explaining
// why — this list is the audit trail for the W-6 decision.
const DIM_SAFE = new Set([
  "text-white", // always on navy/ink/gold fills, which dim re-tunes darker
  "border-white", // thin separators on the navy hero panel
  "ring-white", // focus ring on the navy footer badge
  "bg-red-500",
  "bg-amber-500",
  "bg-emerald-500", // status dots on dark panels
  "bg-emerald-600", // CTA button on dark cards
  "bg-emerald-700", // U-24 WhatsApp pill — solid brand-green fill with white
  // text (>=4.5:1 on emerald-700 in BOTH themes; light theme uses 700 for AA
  // contrast, dim keeps the same saturated green chip)
  "text-emerald-300",
  "text-emerald-400", // glow accents on the car-control deck (dark by design)
  "bg-slate-600",
  "bg-slate-700",
  "bg-slate-800",
  "bg-slate-900", // 3D scene + panel darks
  "border-slate-700",
  "ring-slate-700", // outlines on those dark panels
  "text-red-300", // C4 footer opt-in error text — sits on the ink footer panel (dark in both themes)
]);

function classNamesIn(source: string): string[] {
  const found: string[] = [];
  // className="…", className={'…'}, className={`…`} — literals only.
  const patterns = [/className="([^"]*)"/g, /className=\{'([^']*)'\}/g, /className=\{`([^`]*)`\}/g];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      found.push(...(match[1] ?? "").split(/\s+/).filter(Boolean));
    }
  }
  return found;
}

const used = new Map<string, string>();
for (const dir of SOURCE_DIRS) {
  for (const file of walk(dir)) {
    for (const className of classNamesIn(readFileSync(file, "utf8"))) {
      for (const match of className.matchAll(COLOR_UTILITY)) {
        if (!used.has(match[0])) used.set(match[0], file);
      }
    }
  }
}

const dimCss = GLOBALS_CSS.replace(/\r\n/g, "\n");
// Quote-agnostic attribute selector: prettier (pre-commit, .css in scope) may
// render html[data-theme='dim'] with double quotes — accept either style
// (2026-09-23 sweep, same lesson as the B-6 / sync-app-fallback fixes).
const DIM_SELECTOR = /html\[data-theme=["']dim["']\]/.source;
function hasDimOverride(utility: string): boolean {
  // The dim layer overrides both the base class and its hover/focus variants.
  const escaped = utility.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const direct = new RegExp(`${DIM_SELECTOR}[^{]*\\.${escaped.replace(/\\/g, "")}[^a-z0-9-]`);
  if (direct.test(dimCss)) return true;
  // Grouped selectors put the last class before the `{`: ".bg-white\\/80,\n… { … }"
  const grouped = new RegExp(`\\.(${escaped})(?:\\\\/\\d+)?[,\\n\\s]*[^{]*\\{`);
  return new RegExp(`${DIM_SELECTOR}[^}]*${escaped}`).test(dimCss) || grouped.test(dimCss);
}

describe("dim theme coverage guard (W-6)", () => {
  it("has a dim override (or documented dim-safe exemption) for every color utility used in app/ + components/", () => {
    const missing = [...used.entries()]
      .filter(([utility]) => !DIM_SAFE.has(utility) && !hasDimOverride(utility))
      .map(([utility, file]) => `${utility}  (${file.replace(ROOT, "")})`);
    expect(
      missing,
      `Color utilities without a html[data-theme='dim'] override in globals.css:\n${missing.join("\n")}\n` +
        "Add an override to the dim block in app/globals.css, or add the utility to DIM_SAFE with a comment explaining why it is safe on both themes."
    ).toEqual([]);
  });

  it("keeps the dim layer keyed on html[data-theme] (not a media query)", () => {
    // Quote-agnostic: prettier may flip the attribute quotes (see above).
    expect(dimCss).toMatch(/html\[data-theme=["']dim["']\]/);
  });
});
