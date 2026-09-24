// ux-purchase-flow.mjs — END-TO-END web order regression against the LIVE site.
//
// signup -> product detail -> "Add to build list" -> checkout -> COD submit
// -> /checkout/success?order=… (real order row), then SELF-CLEANUP: the probe
// order + probe auth user are deleted via the service-role key so scheduled
// runs never leave junk in production.
//
// Exit codes: 0 = flow passed, 1 = any step failed (hard gate for CI).
// Env: BASE_URL (default production). Cleanup needs SUPABASE_SERVICE_ROLE_KEY
// (falls back to .env/.env.local when run locally); without it the run still
// reports pass/fail but prints a WARN that artifacts were left behind.
//
// Run: node scripts/ux-purchase-flow.mjs
import puppeteer from "puppeteer-core";
import { existsSync, readFileSync } from "node:fs";

const BASE = process.env.BASE_URL || "https://genumsolutions-website.vercel.app";

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
  return puppeteer.executablePath();
}

function loadServiceKey() {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) return process.env.SUPABASE_SERVICE_ROLE_KEY;
  for (const f of [".env", ".env.local", ".env.production"]) {
    if (!existsSync(f)) continue;
    const m = readFileSync(f, "utf8").match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/);
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  }
  return null;
}

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://bkylfnlybtsujwzropru.supabase.co";

const rand = Math.random().toString(36).slice(2, 8);
const EMAIL = `uxflow-${rand}@genumtest.invalid`;
const results = [];
const step = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? " — " + detail : ""}`);
};

const browser = await puppeteer.launch({
  executablePath: findChrome(),
  headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });
let orderId = null;

try {
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60000 });

  // 1. signup
  const reg = await page.evaluate(async (email) => {
    const r = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "UX Flow Probe", email, password: "Genum-e2e-2026!" }),
    });
    return r.status;
  }, EMAIL);
  step("signup", reg === 200, `status ${reg}`);

  // 2. add to build list from the product page
  await page.goto(BASE + "/products/arduino-uno", { waitUntil: "networkidle2", timeout: 60000 });
  const addBtn = await page.evaluate(() => {
    const a = [...document.querySelectorAll("a")].find((x) =>
      /add to build list/i.test(x.textContent || ""),
    );
    if (!a) return false;
    a.click();
    return true;
  });
  await new Promise((r) => setTimeout(r, 1500));
  step("add to build list", addBtn && page.url().includes("/checkout"), page.url().replace(BASE, ""));

  // 3. checkout shows the item
  await page.goto(BASE + "/checkout", { waitUntil: "networkidle2", timeout: 60000 });
  await new Promise((r) => setTimeout(r, 1500));
  const ck = await page.evaluate(() => {
    const t = document.body.innerText;
    return { hasItem: /arduino/i.test(t), hasCod: /pay on delivery|reserve order/i.test(t) };
  });
  step("checkout shows item", ck.hasItem);
  step("COD button present", ck.hasCod);

  // 4. fill customer details
  const filled = await page.evaluate((email) => {
    const nativeI = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    const nativeT = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
    const setI = (el, v) => {
      nativeI.call(el, v);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    };
    let n = 0;
    for (const el of document.querySelectorAll("input, textarea")) {
      const label =
        el.closest("label")?.textContent?.toLowerCase() || el.placeholder?.toLowerCase() || "";
      const type = (el.type || "").toLowerCase();
      if (el.tagName === "TEXTAREA" || /address/.test(label)) {
        (el.tagName === "TEXTAREA" ? nativeT : nativeI).call(el, "Ward 10, Jhamsikhel, Lalitpur");
        el.dispatchEvent(new Event("input", { bubbles: true }));
        n++;
      } else if (type === "email" || /email/.test(label)) {
        setI(el, email);
        n++;
      } else if (/phone/.test(label)) {
        setI(el, "9801234567");
        n++;
      } else if (/full name|your name|^name$/.test(label) && !el.value) {
        setI(el, "UX Flow Probe");
        n++;
      }
    }
    return n;
  }, EMAIL);
  step("form filled", filled >= 4, `${filled} fields`);

  // 5. submit COD and land on the success page with an order ref
  await page.evaluate(() => {
    [...document.querySelectorAll("button")]
      .find((x) => /pay on delivery|reserve order/i.test(x.textContent || ""))
      ?.click();
  });
  await page.waitForFunction(
    () => /checkout\/success/.test(location.pathname + location.search),
    { timeout: 30000 },
  ).catch(() => undefined);
  await new Promise((r) => setTimeout(r, 1500));
  const after = await page.evaluate(() => ({
    url: location.pathname + location.search,
    ref: (document.body.innerText.match(/order reference[:\s]+([A-Z0-9]+)/i) || [])[1] || null,
  }));
  orderId = after.url.match(/order=([\w-]+)/)?.[1] ?? null;
  step("order placed", /checkout\/success/.test(after.url) && !!orderId, after.url);

  // 6. order actually persisted with the right shape (service-role read)
  const key = loadServiceKey();
  if (key && orderId) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${orderId}&select=*`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    const rows = res.ok ? await res.json() : [];
    const o = rows[0];
    step(
      "order row verified",
      !!o && o.status && o.total_npr > 0,
      o ? `status=${o.status} total=${o.total_npr}` : "row missing",
    );
  } else {
    step("order row verified", false, "no service key or order id");
  }
} catch (e) {
  step("flow crashed", false, String(e).slice(0, 200));
} finally {
  // SELF-CLEANUP: order_items -> order -> auth user
  const key = loadServiceKey();
  if (key && orderId) {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/order_items?order_id=eq.${orderId}`, {
        method: "DELETE",
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      });
      const del = await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${orderId}`, {
        method: "DELETE",
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      });
      console.log(`CLEANUP order ${orderId.slice(0, 8)}: HTTP ${del.status}`);
    } catch (e) {
      console.log("CLEANUP order failed:", String(e).slice(0, 120));
    }
  } else {
    console.log("WARN: no order to clean up (or no service key) — check production manually");
  }
  if (key) {
    try {
      // lookup the probe user by email, then delete by id (admin API)
      const lookup = await fetch(
        `${SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(EMAIL)}`,
        { headers: { apikey: key, Authorization: `Bearer ${key}` } },
      );
      const body = lookup.ok ? await lookup.json() : null;
      const uid = body?.users?.[0]?.id;
      if (uid) {
        const del = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${uid}`, {
          method: "DELETE",
          headers: { apikey: key, Authorization: `Bearer ${key}` },
        });
        console.log(`CLEANUP user ${EMAIL}: HTTP ${del.status}`);
      }
    } catch (e) {
      console.log("CLEANUP user failed:", String(e).slice(0, 120));
    }
  }
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} steps passed`);
process.exit(failed.length ? 1 : 0);
