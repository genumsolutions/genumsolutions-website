// ux-purchase-flow.mjs — END-TO-END regression against the LIVE site.
//
// Three flows, each with asserts and SELF-CLEANUP (probe rows deleted via the
// service-role key so scheduled runs never leave junk in production):
//   1. PURCHASE: signup → build list → checkout → COD submit
//      → /checkout/success?order=… → order row verified.
//   2. CONTACT: form submit → success status → row verified in
//      customer_messages → deleted.
//   3. NEWSLETTER: footer opt-in → done state → row verified in
//      newsletter_subscribers → deleted.
//
// Exit codes: 0 = all flows passed, 1 = any step failed (hard gate for CI).
// Env: BASE_URL (default production). Cleanup/verification needs
// SUPABASE_SERVICE_ROLE_KEY (falls back to .env/.env.local when run locally);
// without it the run still reports pass/fail but prints a WARN.
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
  const flow =
    results.length < 5
      ? "purchase"
      : results.length < 9
        ? "contact"
        : results.length < 13
          ? "newsletter"
          : results.length < 16
            ? "auth"
            : results.length < 18
              ? "profile"
              : "cart";
  results.push({ flow, name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} [${flow}] ${name}${detail ? " — " + detail : ""}`);
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
      /add to build list/i.test(x.textContent || "")
    );
    if (!a) return false;
    a.click();
    return true;
  });
  await new Promise((r) => setTimeout(r, 1500));
  step(
    "add to build list",
    addBtn && page.url().includes("/checkout"),
    page.url().replace(BASE, "")
  );

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
    const nativeT = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      "value"
    ).set;
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
  await page
    .waitForFunction(() => /checkout\/success/.test(location.pathname + location.search), {
      timeout: 30000,
    })
    .catch(() => undefined);
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
      o ? `status=${o.status} total=${o.total_npr}` : "row missing"
    );
  } else {
    step("order row verified", false, "no service key or order id");
  }

  // ---------- FLOW 2: CONTACT (guest inquiry, no account needed) ----------
  await page.goto(BASE + "/contact", { waitUntil: "networkidle2", timeout: 60000 });
  const contactFilled = await page.evaluate((email) => {
    const nativeI = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    const nativeT = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      "value"
    ).set;
    const set = (el, v) => {
      (el.tagName === "TEXTAREA" ? nativeT : nativeI).call(el, v);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    };
    let n = 0;
    for (const el of document.querySelectorAll("input, textarea")) {
      const name = (el.name || "").toLowerCase();
      if (name === "name") {
        set(el, "UX Flow Probe");
        n++;
      } else if (name === "email") {
        set(el, email);
        n++;
      } else if (name === "message") {
        set(el, "ux-flow contact regression probe — safe to delete");
        n++;
      }
    }
    return n;
  }, EMAIL);
  step("contact form filled", contactFilled === 3, `${contactFilled}/3 fields`);
  await page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .find((b) => /send inquiry/i.test(b.textContent || ""))
      ?.click()
  );
  const contactOk = await page
    .waitForFunction(
      () =>
        document.querySelector('[role="status"]')?.textContent?.length > 0 &&
        !/sending/i.test(document.querySelector('[role="status"]')?.textContent || ""),
      { timeout: 20000 }
    )
    .then(() => true)
    .catch(() => false);
  const contactMsg = contactOk
    ? await page.evaluate(() => document.querySelector('[role="status"]')?.textContent || "")
    : "";
  step("contact submitted", contactOk, contactMsg.slice(0, 80));

  // verify + clean the customer_messages row
  const key2 = loadServiceKey();
  if (key2) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/customer_messages?email=eq.${encodeURIComponent(EMAIL)}&select=*`,
      { headers: { apikey: key2, Authorization: `Bearer ${key2}` } }
    );
    const rows = res.ok ? await res.json() : [];
    step(
      "contact row verified",
      rows.length > 0,
      rows.length ? `status=${rows[0].status ?? "n/a"}` : "row missing"
    );
    if (rows.length) {
      const del = await fetch(
        `${SUPABASE_URL}/rest/v1/customer_messages?email=eq.${encodeURIComponent(EMAIL)}`,
        { method: "DELETE", headers: { apikey: key2, Authorization: `Bearer ${key2}` } }
      );
      console.log(`CLEANUP contact row: HTTP ${del.status}`);
    }
  } else {
    step("contact row verified", false, "no service key");
  }

  // ---------- FLOW 3: NEWSLETTER (footer opt-in, consent checkbox required) ----------
  await page.goto(BASE + "/", { waitUntil: "networkidle2", timeout: 60000 });
  // Tick consent the way a human does — click the LABEL (React listens to
  // change on the checkbox; synthetic .checked writes don't survive it).
  const consentTicked = await page.evaluate(() => {
    const label = [...document.querySelectorAll("label")].find((l) =>
      /email me news/i.test(l.textContent || "")
    );
    if (!label) return false;
    label.click();
    return true;
  });
  const newsFilled = await page.evaluate((email) => {
    const nativeI = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    let n = 0;
    const emailInput = document.querySelector('input[id^="newsletter-email"]');
    if (emailInput) {
      nativeI.call(emailInput, email);
      emailInput.dispatchEvent(new Event("input", { bubbles: true }));
      n++;
    }
    const consent = document.querySelector('input[type="checkbox"]');
    if (consent?.checked) n++;
    return n;
  }, EMAIL);
  step("newsletter form filled", consentTicked && newsFilled === 2, `${newsFilled}/2 controls`);
  await page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .find((b) => /subscribe/i.test(b.textContent || ""))
      ?.click()
  );
  const newsOk = await page
    .waitForFunction(
      () =>
        [...document.querySelectorAll('[role="status"]')].some((p) =>
          /on the list|✓/i.test(p.textContent || "")
        ),
      { timeout: 20000 }
    )
    .then(() => true)
    .catch(() => false);
  step("newsletter submitted", newsOk);

  // verify + clean the newsletter_subscribers row
  if (key2) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/newsletter_subscribers?email=eq.${encodeURIComponent(EMAIL)}&select=*`,
      { headers: { apikey: key2, Authorization: `Bearer ${key2}` } }
    );
    const rows = res.ok ? await res.json() : [];
    step(
      "newsletter row verified",
      rows.length > 0 && rows[0].status === "subscribed",
      rows.length ? `status=${rows[0].status}` : "row missing"
    );
    if (rows.length) {
      const del = await fetch(
        `${SUPABASE_URL}/rest/v1/newsletter_subscribers?email=eq.${encodeURIComponent(EMAIL)}`,
        { method: "DELETE", headers: { apikey: key2, Authorization: `Bearer ${key2}` } }
      );
      console.log(`CLEANUP newsletter row: HTTP ${del.status}`);
    }
  } else {
    step("newsletter row verified", false, "no service key");
  }

  // ---------- FLOW 4: LOGIN AFTER LOGOUT (session round-trip) ----------
  // The purchase flow already registered the probe user; sign out, then sign
  // back in through the real UI and confirm the account page loads again.
  // The account panel hydrates late — wait for the Log out button to exist.
  await page.goto(BASE + "/account", { waitUntil: "networkidle2", timeout: 60000 });
  const logoutBtn = await page
    .waitForFunction(
      () =>
        [...document.querySelectorAll("button")].some((b) =>
          /^log out$/i.test(b.textContent?.trim() || "")
        ),
      { timeout: 15000 }
    )
    .then(() => true)
    .catch(() => false);
  await page.evaluate(() => {
    [...document.querySelectorAll("button")]
      .find((b) => /^log out$/i.test(b.textContent?.trim() || ""))
      ?.click();
  });
  // signOut() redirects to "/" — wait for the guest state to be visible.
  // Flake guard: an occasional slow logout POST can outlive one window, so
  // click + wait again before declaring failure (scheduled runs must be
  // deterministic; a single retry absorbs transient latency).
  const waitGuest = () =>
    page
      .waitForFunction(
        () => location.pathname === "/" && /sign in/i.test(document.body.innerText),
        {
          timeout: 20000,
        }
      )
      .then(() => true)
      .catch(() => false);
  let loggedOut = await waitGuest();
  if (!loggedOut) {
    await page.evaluate(() => {
      [...document.querySelectorAll("button")]
        .find((b) => /^log out$/i.test(b.textContent?.trim() || ""))
        ?.click();
    });
    loggedOut = await waitGuest();
  }
  step("logout works", logoutBtn && loggedOut, page.url().replace(BASE, ""));

  await page.goto(BASE + "/login", { waitUntil: "networkidle2", timeout: 60000 });
  await page.evaluate(() => {
    const tab = [...document.querySelectorAll("button")].find((x) =>
      /^sign in$/i.test(x.textContent?.trim() || "")
    );
    if (tab) tab.click();
  });
  const loginFilled = await page.evaluate((email) => {
    const nativeI = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    let n = 0;
    for (const el of document.querySelectorAll("input")) {
      if (el.name === "email") {
        nativeI.call(el, email);
        el.dispatchEvent(new Event("input", { bubbles: true }));
        n++;
      } else if (el.name === "password") {
        nativeI.call(el, "Genum-e2e-2026!");
        el.dispatchEvent(new Event("input", { bubbles: true }));
        n++;
      }
    }
    return n;
  }, EMAIL);
  step("login form filled", loginFilled === 2, `${loginFilled}/2 fields`);
  await page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .find((b) => /^sign in$/i.test(b.textContent?.trim() || "") && b.type === "submit")
      ?.click()
  );
  const backIn = await page
    .waitForFunction(() => /\/account|\/admin/.test(location.pathname), { timeout: 20000 })
    .then(() => true)
    .catch(() => false);
  step("login round-trip", backIn, page.url().replace(BASE, ""));

  // ---------- FLOW 5: PROFILE SAVE (account details round-trip) ----------
  // Only meaningful when signed in (flow 4 just got us there).
  if (backIn) {
    await page.goto(BASE + "/account", { waitUntil: "networkidle2", timeout: 60000 });
    // Profile fields render only after /api/customer/me resolves — wait for them.
    const profileReady = await page
      .waitForFunction(() => !!document.querySelector('input[name="phone"]'), {
        timeout: 20000,
      })
      .then(() => true)
      .catch(() => false);
    const profileSet = profileReady
      ? await page.evaluate(() => {
          const nativeI = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype,
            "value"
          ).set;
          const nativeT = Object.getOwnPropertyDescriptor(
            window.HTMLTextAreaElement.prototype,
            "value"
          ).set;
          const set = (el, v) => {
            (el.tagName === "TEXTAREA" ? nativeT : nativeI).call(el, v);
            el.dispatchEvent(new Event("input", { bubbles: true }));
          };
          let n = 0;
          for (const el of document.querySelectorAll("input, textarea")) {
            if (el.name === "phone") {
              set(el, "9801234567");
              n++;
            } else if (el.name === "address") {
              set(el, "ux-flow profile probe, Lalitpur");
              n++;
            }
          }
          return n;
        })
      : 0;
    step("profile form present", profileSet === 2, `${profileSet}/2 fields`);
    await page.evaluate(() =>
      [...document.querySelectorAll("button")]
        .find((b) => /save details/i.test(b.textContent || ""))
        ?.click()
    );
    const saved = await page
      .waitForFunction(
        () =>
          [...document.querySelectorAll('[role="status"]')].some((p) =>
            /details saved/i.test(p.textContent || "")
          ),
        { timeout: 15000 }
      )
      .then(() => true)
      .catch(() => false);
    step("profile saved", saved);
  } else {
    step("profile form present", false, "skipped: login round-trip failed");
    step("profile saved", false, "skipped: login round-trip failed");
  }

  // ---------- FLOW 6: CART QUANTITY EDIT (checkout qty controls) ----------
  await page.goto(BASE + "/products/arduino-uno", { waitUntil: "networkidle2", timeout: 60000 });
  await page.evaluate(() => {
    const a = [...document.querySelectorAll("a")].find((x) =>
      /add to build list/i.test(x.textContent || "")
    );
    if (a) a.click();
  });
  await new Promise((r) => setTimeout(r, 1500));
  await page.goto(BASE + "/checkout", { waitUntil: "networkidle2", timeout: 60000 });
  await new Promise((r) => setTimeout(r, 1200));
  const qtyBefore = await page.evaluate(() => {
    const plus = [...document.querySelectorAll("button")].find((b) =>
      /add another/i.test(b.getAttribute("aria-label") || "")
    );
    if (plus) plus.click();
    return !!plus;
  });
  await new Promise((r) => setTimeout(r, 800));
  const qtyAfter = await page.evaluate(() => {
    const badge = document.querySelector('[aria-live="polite"]');
    return badge?.textContent?.trim() ?? null;
  });
  step("cart qty + works", qtyBefore && qtyAfter === "2", `qty now ${qtyAfter}`);
  const removed = await page.evaluate(() => {
    const rm = [...document.querySelectorAll("button")].find((b) =>
      /remove/i.test(b.getAttribute("aria-label") || "")
    );
    if (rm) rm.click();
    return !!rm;
  });
  await new Promise((r) => setTimeout(r, 800));
  const emptyAfterRemove = await page.evaluate(() =>
    /build list is empty|no purchasable items|some items in your build list/i.test(
      document.body.innerText
    )
  );
  step("cart remove works", removed && emptyAfterRemove);
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
        { headers: { apikey: key, Authorization: `Bearer ${key}` } }
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
for (const flow of ["purchase", "contact", "newsletter", "auth", "profile", "cart"]) {
  const steps = results.filter((r) => r.flow === flow);
  if (steps.length)
    console.log(`${flow}: ${steps.filter((s) => s.ok).length}/${steps.length} steps`);
}
console.log(`\n${results.length - failed.length}/${results.length} steps passed`);
process.exit(failed.length ? 1 : 0);
