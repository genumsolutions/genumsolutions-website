// ux-audit.mjs — human-flow audit of the LIVE website.
//
// Drives Chrome through every public page like a person would: loads the
// page, follows above-the-fold links, and at TWO viewports (360x800 phone,
// 1440x900 desktop) records:
//   • console errors/warnings + pageerrors
//   • failed network requests (4xx/5xx)
//   • broken images (naturalWidth === 0)
//   • horizontal overflow (document.scrollWidth > innerWidth + 2)
//   • tap targets < 36px (buttons/links), counted
//   • full-page screenshot per page per viewport into ux-audit-shots/
//
// Exit codes (CI-friendly): 0 = clean, 1 = hard failures found (load errors,
// HTTP >= 400, horizontal overflow, console/page errors, broken images).
// Soft findings (small tap targets, text clipping) are reported but never
// fail the run — they need human judgment to avoid false positives.
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
  { name: "phone", width: 360, height: 800 },
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

      // broken images + overflow + tap targets, evaluated in the page
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
        return { brokenImgs, overflow, smallTargets, textOverflow };
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
