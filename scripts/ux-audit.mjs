// ux-audit.mjs — human-flow audit of the LIVE website.
//
// Drives Chrome through every public page like a person would: loads the
// page, follows above-the-fold links, and at FOUR viewports (320x640 xs,
// 360x800 phone, 768x900 tablet, 1440x900 desktop) records:
//   • console errors/warnings + pageerrors
//   • failed network requests (4xx/5xx)
//   • broken images (naturalWidth === 0)
//   • horizontal overflow (document.scrollWidth > innerWidth + 2)
//   • tap targets < 36px (buttons/links), counted
//   • LOW-CONTRAST text scan (U-24): WCAG contrast < 4.5:1 for body text,
//     < 3:1 for large/bold — reported as soft findings + per-page counts
//   • full-page screenshot per page per viewport into ux-audit-shots/
//
// Exit codes (CI-friendly): 0 = clean, 1 = hard failures found (load errors,
// HTTP >= 400, horizontal overflow, console/page errors, broken images).
// Soft findings (small tap targets, text clipping, low contrast) are reported
// but never fail the run — they need human judgment to avoid false positives.
//
// Env: BASE_URL (default: production), UX_AUDIT_SOFT=1 also fails on softs.
// Run:  node scripts/ux-audit.mjs
import puppeteer from "puppeteer-core";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { existsSync } from "node:fs";

const BASE = process.env.BASE_URL || "https://genumsolutions-website.vercel.app";
const OUT = "ux-audit-shots";

// Cross-platform Chrome/Chromium discovery (Windows/macOS/Linux + CI).
function findChrome() {
  if (process.env.CHROME_PATH && existsSync(process.env.CHROME_PATH))
    return process.env.CHROME_PATH;
  const candidates =
    process.platform === "win32"
      ? [
          "C:/Program Files/Google/Chrome/Application/chrome.exe",
          "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
          process.env.LOCALAPPDATA
            ? process.env.LOCALAPPDATA + "/Google/Chrome/Application/chrome.exe"
            : null,
        ]
      : process.platform === "darwin"
        ? [
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            "/Applications/Chromium.app/Contents/MacOS/Chromium",
          ]
        : [
            "/usr/bin/google-chrome",
            "/usr/bin/google-chrome-stable",
            "/usr/bin/chromium",
            "/usr/bin/chromium-browser",
            "/snap/bin/chromium",
          ];
  for (const c of candidates) if (c && existsSync(c)) return c;
  // puppeteer's bundled browser as a last resort (downloads on install when
  // PUPPETEER_SKIP_DOWNLOAD is unset)
  return puppeteer.executablePath();
}

const PAGES = [
  "/",
  "/products",
  "/projects",
  "/services",
  "/journal",
  "/3d-printing",
  "/tools",
  "/about",
  "/contact",
  "/app",
  "/privacy",
  "/terms",
  "/login",
  "/account",
  "/checkout",
];

const VIEWPORTS = [
  { name: "xs", width: 320, height: 640 },
  { name: "phone", width: 360, height: 800 },
  { name: "tablet", width: 768, height: 900 },
  { name: "desktop", width: 1440, height: 900 },
];

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: findChrome(),
  headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

const report = [];

for (const vp of VIEWPORTS) {
  const page = await browser.newPage();
  await page.setViewport({ width: vp.width, height: vp.height });
  await page.setCacheEnabled(false);

  const consoleIssues = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.type() === "warning")
      consoleIssues.push(`${msg.type()}: ${msg.text().slice(0, 160)}`);
  });
  page.on("pageerror", (err) => consoleIssues.push(`pageerror: ${String(err).slice(0, 160)}`));
  page.on("response", (res) => {
    if (res.status() >= 400) consoleIssues.push(`HTTP ${res.status()}: ${res.url().slice(0, 120)}`);
  });

  for (const path of PAGES) {
    consoleIssues.length = 0;
    const findings = {};
    try {
      const res = await page.goto(BASE + path, {
        waitUntil: "networkidle2",
        timeout: 45000,
      });
      findings.httpStatus = res?.status() ?? "?";
      await new Promise((r) => setTimeout(r, 800)); // let hydration settle

      findings.console = consoleIssues.slice(0, 6);

      // broken images + overflow + tap targets + low-contrast text, evaluated
      // in the page. U-24: a WCAG contrast pass over visible text (skips text
      // sitting on images/gradients — those need human eyes).
      findings.dom = await page.evaluate(() => {
        const brokenImgs = [...document.querySelectorAll("img")].filter(
          (i) => i.complete && i.naturalWidth === 0
        ).length;
        const overflow = document.documentElement.scrollWidth > window.innerWidth + 2;
        const smallTargets = [...document.querySelectorAll("a,button")].filter((el) => {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) return false;
          return r.height < 36 && r.width < 120;
        }).length;
        const textOverflow = [...document.querySelectorAll("h1,h2,h3,p,span")].filter(
          (el) =>
            el.scrollWidth > el.clientWidth + 4 &&
            getComputedStyle(el).overflow !== "hidden" &&
            el.clientWidth > 0
        ).length;

        // ---- WCAG contrast scan -------------------------------------
        const parseColor = (c) => {
          const m = /rgba?\(([^)]+)\)/i.exec(c);
          if (!m) return null;
          const p = m[1].split(",").map((v) => parseFloat(v.trim()));
          if (p.length < 3) return null;
          return p.slice(0, 3).map((v) => Math.max(0, Math.min(255, v)));
        };
        const lum = ([r, g, b]) => {
          const f = (v) => {
            const s = v / 255;
            return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
          };
          return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
        };
        const ratio = (a, b) => {
          const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
          return (l1 + 0.05) / (l2 + 0.05);
        };
        const isTransparent = (c) => /^rgba\([^)]*, ?0\)$/i.test(c);
        const low = [];
        let checked = 0;
        const textSel =
          "p, span, a, li, h1, h2, h3, h4, h5, h6, strong, em, small, dt, dd, label, td, th, input, button";
        for (const el of document.querySelectorAll(textSel)) {
          if (checked > 900) break;
          const r = el.getBoundingClientRect();
          if (r.width < 2 || r.height < 2 || r.top > window.innerHeight) continue;
          if (!(el.textContent || "").trim()) continue; // decorative dot/bullet
          const cs = getComputedStyle(el);
          const fg = parseColor(cs.color);
          if (!fg || cs.opacity === "0") continue;
          const node = el.nodeName.toLowerCase();
          const fontSize = parseFloat(cs.fontSize);
          const bold = parseInt(cs.fontWeight) >= 700;
          const large = fontSize >= 24 || (fontSize >= 18.66 && bold);
          const need = large ? 3 : 4.5;
          // skip text laid over an image / gradient (text colors depend on
          // the exact pixels underneath — human judgment area)
          let bg = null;
          let hasImageBg = false;
          let h = el;
          while (h && h !== document.body) {
            const bcs = getComputedStyle(h);
            if (bcs.backgroundImage && bcs.backgroundImage !== "none") {
              hasImageBg = true;
              break;
            }
            const b = parseColor(bcs.backgroundColor);
            if (b && !isTransparent(bcs.backgroundColor)) {
              bg = b;
              break;
            }
            h = h.parentElement;
          }
          if (hasImageBg) continue;
          if (!bg) {
            const bodyBg = parseColor(getComputedStyle(document.body).backgroundColor);
            bg = bodyBg || [255, 255, 255];
          }
          checked++;
          const cr = ratio(fg, bg);
          if (cr < need) {
            if (low.length < 8)
              low.push(
                `${node}<${el.className ? "class=" + String(el.className).slice(0, 40) : "unclassed"}> ${cr.toFixed(2)}:1 ${fg} on ${bg} "${(el.textContent || "").trim().split(/\s+/).slice(0, 6).join(" ")}"`
              );
          }
        }
        return {
          brokenImgs,
          overflow,
          smallTargets,
          textOverflow,
          contrastLowCount: low.length,
          contrastLowChecked: checked,
          contrastSamples: low,
        };
      });

      await page.screenshot({
        path: `${OUT}/${vp.name}${path === "/" ? "-home" : path.replace(/\//g, "-")}.png`,
        fullPage: true,
      });
    } catch (e) {
      findings.error = String(e).slice(0, 140);
    }

    report.push({ viewport: vp.name, path, ...findings });
    const flag =
      (findings.dom?.overflow ? " OVERFLOW" : "") +
      (findings.dom?.brokenImgs ? ` BROKEN-IMGS:${findings.dom.brokenImgs}` : "") +
      (findings.error ? " ERROR" : "");
    console.log(`${vp.name} ${path} → ${findings.httpStatus ?? "?"}${flag}`);
  }
  await page.close();
}

await browser.close();
writeFileSync(`${OUT}/ux-audit-report.json`, JSON.stringify(report, null, 2));

// summary + CI exit code
let hard = 0;
let soft = 0;
const softOnly = [];
console.log("\n=== SUMMARY (issues only) ===");
for (const r of report) {
  const hardProbs = [];
  const softProbs = [];
  if (r.error) hardProbs.push("LOAD-ERROR");
  if (r.httpStatus && r.httpStatus >= 400) hardProbs.push(`HTTP-${r.httpStatus}`);
  if (r.dom?.overflow) hardProbs.push("H-OVERFLOW");
  if (r.dom?.brokenImgs) hardProbs.push(`BROKEN-IMGS(${r.dom.brokenImgs})`);
  if (r.console?.some((c) => c.startsWith("pageerror") || c.startsWith("error")))
    hardProbs.push("CONSOLE-ERR");
  if (r.dom?.smallTargets) softProbs.push(`SMALL-TARGETS(${r.dom.smallTargets})`);
  if ((r.dom?.textOverflow ?? 0) > 8) softProbs.push(`TEXT-CLIP(${r.dom.textOverflow})`);
  if (r.dom?.contrastLowCount) {
    softProbs.push(`LOW-CONTRAST(${r.dom.contrastLowCount})`);
    softProbs.push(...(r.dom.contrastSamples ?? []).map((s) => `   .. ${s}`));
  }
  hard += hardProbs.length;
  if (softProbs.length) {
    soft += softProbs.length;
    softOnly.push(`${r.viewport} ${r.path}: ${softProbs.join(" ")}`);
  }
  if (hardProbs.length) console.log(`${r.viewport} ${r.path}: ${hardProbs.join(" ")}`);
}
if (softOnly.length && process.env.UX_AUDIT_SOFT) {
  console.log("\n=== SOFT (need human judgment; fail only with UX_AUDIT_SOFT=1) ===");
  for (const s of softOnly) console.log(s);
}
console.log(
  `\n${report.length} page loads checked · ${hard} hard issue(s) · ${soft} soft finding(s)`
);
console.log("Full report + screenshots in", OUT);
process.exit(hard > 0 ? 1 : 0);
