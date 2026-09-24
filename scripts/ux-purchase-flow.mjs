// ux-flows9 — END-TO-END web COD order: signup -> add -> checkout -> submit -> success page
import puppeteer from "puppeteer-core";
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const BASE = "https://genumsolutions-website.vercel.app";
const rand = Math.random().toString(36).slice(2, 8);
const EMAIL = `ux9-${rand}@genumtest.invalid`;
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });
page.on("pageerror", (e) => console.log("PAGEERROR:", e.message.slice(0, 160)));

await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60000 });
console.log("1. signup:", await page.evaluate(async (email) => (await fetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "UX Nine", email, password: "Genum-e2e-2026!" }) })).status, EMAIL));

await page.goto(BASE + "/products/arduino-uno", { waitUntil: "networkidle2", timeout: 60000 });
await page.evaluate(() => [...document.querySelectorAll("a")].find((x) => /add to build list/i.test(x.textContent || ""))?.click());
await new Promise((r) => setTimeout(r, 1500));
console.log("2. added, at:", page.url().replace(BASE, ""));

await page.goto(BASE + "/checkout", { waitUntil: "networkidle2", timeout: 60000 });
await new Promise((r) => setTimeout(r, 1500));
const filled = await page.evaluate(() => {
  const nativeI = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  const nativeT = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
  const setI = (el, v) => { nativeI.call(el, v); el.dispatchEvent(new Event("input", { bubbles: true })); };
  let n = 0;
  for (const el of document.querySelectorAll("input, textarea")) {
    const label = el.closest("label")?.textContent?.toLowerCase() || el.placeholder?.toLowerCase() || "";
    const type = (el.type || "").toLowerCase();
    if (el.tagName === "TEXTAREA" || /address/.test(label)) { (el.tagName === "TEXTAREA" ? nativeT : nativeI).call(el, "Ward 10, Jhamsikhel, Lalitpur"); el.dispatchEvent(new Event("input", { bubbles: true })); n++; }
    else if (type === "email" || /email/.test(label)) { setI(el, "ux9@genumtest.invalid"); n++; }
    else if (/phone/.test(label)) { setI(el, "9801234567"); n++; }
    else if (/full name|your name|^name$/.test(label) && !el.value) { setI(el, "UX Nine"); n++; }
  }
  return n;
});
console.log("3. filled fields:", filled);
const before = await page.evaluate(() => ({ url: location.pathname, msg: document.body.innerText.match(/sign in to place your order/i)?.[0] || null, hasItem: /arduino/i.test(document.body.innerText) }));
console.log("4. pre-submit state:", JSON.stringify(before));
await page.evaluate(() => [...document.querySelectorAll("button")].find((x) => /pay on delivery|reserve order/i.test(x.textContent || ""))?.click());
await new Promise((r) => setTimeout(r, 5000));
const after = await page.evaluate(() => ({ url: location.pathname + location.search, text: document.body.innerText.slice(0, 260) }));
console.log("5. after submit:", JSON.stringify(after));
await browser.close();
