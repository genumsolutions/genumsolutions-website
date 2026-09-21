// =====================================================================
// push-e2e.mjs — LIVE browser Web Push test (W-3 final verification).
//
// What it does, in order:
//   1. Creates a disposable customer (auth admin API; `.invalid` email).
//   2. Launches the machine's real Chrome (headless) and grants the site
//      the `notifications` permission for the origin (deterministic —
//      same outcome as a human clicking "Allow").
//   3. Signs in through the REAL UI (/account form), clicks the REAL
//      "Turn on notifications" button → real PushManager subscription
//      against the real FCM endpoint + real /api/push/subscribe insert.
//   4. Verifies the subscription row landed in Supabase (RLS, own row).
//   5. Creates a real order, flips its status → the DB trigger fires
//      pg_net → push-order-status → VAPID-signed aes128gcm push → the
//      browser's service worker receives it.
//   6. Detects the arrival IN the browser (SW state message + shown
//      notifications), asserts every step, cleans everything up.
//
// Run:  node scripts/push-e2e.mjs
// Needs .env.local: SUPABASE_* keys (already present).
// =====================================================================
import { readFileSync } from 'node:fs'
import puppeteer from 'puppeteer-core'
import { createClient } from '@supabase/supabase-js'

const env = {}
for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/)
  if (m) env[m[1]] = (m[2] || '').replace(/^["']|["']$/g, '')
}
// Default: production. Override with E2E_BASE_URL (e.g. http://localhost:3000
// for a local production build — same Supabase backend, edge function, and
// VAPID keys, so the push pipeline under test is the same).
const BASE = process.env.E2E_BASE_URL || 'https://genumsolutions-website.vercel.app'
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const rand = Math.random().toString(36).slice(2, 10)
const email = `push-e2e-${rand}@genumtest.invalid`
const password = 'Xk9!' + rand + 'Zq'

const service = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

let userId, orderId, browser
const results = []
const assert = (name, ok, detail = '') => {
  results.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

try {
  // ---- 1. disposable customer -------------------------------------------------
  const u = await service.auth.admin.createUser({ email, password, email_confirm: true })
  if (u.error) throw new Error('createUser: ' + u.error.message)
  userId = u.data.user.id
  console.log(`test user: ${email}`)

  // ---- 2. real Chrome, notifications auto-granted for the origin --------------
  browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-first-run', '--disable-features=Translate', '--disable-blink-features=AutomationControlled'],
  })
  const context = browser.defaultBrowserContext()
  await context.overridePermissions(BASE, ['notifications'])
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 900 })
  page.setDefaultTimeout(30000)
  // Network forensics + a reliable sign-in latch: Next's client router can
  // stall in headless after a successful login, so instead of waiting for the
  // router we latch on the login response itself and do a full reload (the
  // session cookies make the fresh SSR render the signed-in view).
  let loginSettle = null
  let subscribeSettle = null
  const loginDone = new Promise((resolve) => (loginSettle = resolve))
  page.on('response', (r) => {
    if (r.url().includes('/api/auth/login')) {
      console.log(`[net] login response: HTTP ${r.status()}`)
      loginSettle(r.status())
    }
  })
  page.on('requestfailed', (r) => {
    if (r.url().includes('/api/auth/login')) console.log(`[net] login request FAILED: ${r.failure() && r.failure().errorText}`)
  })

  // ---- 3. sign in through the real UI ----------------------------------------
  await page.goto(BASE + '/account', { waitUntil: 'networkidle2' })
  // The auth panel may render in sign-up mode by default — switch to sign-in.
  await page.evaluate(() => {
    const sw = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent.trim().toLowerCase().startsWith('i already have an account'),
    )
    if (sw) sw.click()
    return Boolean(sw)
  })
  try {
    await page.waitForSelector('input[name="email"]', { timeout: 20000 })
  } catch {
    throw new Error('sign-in form not found on /account — dumping selectors: ' +
      (await page.evaluate(() => Array.from(document.querySelectorAll('button,input')).map((el) => el.tagName + ':' + (el.name || el.textContent || '').trim().slice(0, 30)).join(' | '))))
  }
  await page.type('input[name="email"]', email)
  await page.type('input[name="password"]', password)
  await page.waitForFunction(() => {
    const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.trim().toLowerCase() === 'sign in')
    return Boolean(btn) && Boolean(document.querySelector('input[name="email"]'))
  }, { timeout: 15000, polling: 500 })
  const submitted = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent.trim().toLowerCase() === 'sign in',
    )
    if (btn) {
      btn.click()
      return 'button'
    }
    const form = document.querySelector('form')
    if (form) {
      form.requestSubmit()
      return 'form.requestSubmit'
    }
    return null
  })
  if (!submitted) throw new Error('no sign-in button or form found to submit')
  console.log(`submitted via: ${submitted}`)
  const loginStatus = await Promise.race([
    loginDone,
    new Promise((resolve) => setTimeout(() => resolve('timeout'), 45000)),
  ])
  if (loginStatus !== 200) throw new Error(`login API did not return 200 (${loginStatus})`)
  assert('sign-in form accepted the credentials (login API 200)', true)
  // Full reload with the fresh session cookies (equivalent to the user refreshing).
  await page.goto(BASE + '/account', { waitUntil: 'networkidle2' })
  try {
    // polling: 500 — default rAF polling is throttled/paused in headless Chrome.
    await page.waitForFunction(() => document.body.innerText.includes('Order notifications'), { timeout: 45000, polling: 500 })
  } catch {
    const bodyText = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 600))
    const stillForm = await page.evaluate(() => Boolean(document.querySelector('input[name="password"]')))
    throw new Error(`sign-in did not reach the account view (form still present: ${stillForm}). page says: ${bodyText}`)
  }
  assert('sign-in via real UI', true)

  // ---- subscribe through the real button --------------------------------------
  const subscribeDone = new Promise((resolve) => (subscribeSettle = resolve))
  page.on('response', (r) => {
    if (r.url().includes('/api/push/subscribe')) {
      console.log(`[net] push/subscribe response: HTTP ${r.status()}`)
      subscribeSettle(r.status())
    }
  })
  const clicked = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.includes('Turn on notifications'))
    if (btn) {
      btn.click()
      return true
    }
    return false
  })
  if (!clicked) throw new Error('"Turn on notifications" button not found')
  try {
    await page.waitForFunction(() => document.body.innerText.includes('Turn off on this device'), { timeout: 45000, polling: 500 })
  } catch {
    const diag = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration()
      const regState = reg ? (reg.active && reg.active.state) || 'no-active-worker' : 'no-registration'
      const sub = reg ? await reg.pushManager.getSubscription() : null
      const alert = document.querySelector('[role="alert"]')
      const statusEl = document.querySelector('[role="status"]')
      return {
        permission: (window.Notification && Notification.permission) || 'n/a',
        swState: regState,
        hasSubscription: Boolean(sub),
        endpoint: sub ? sub.endpoint.slice(0, 60) : null,
        alertText: alert ? alert.textContent : null,
        statusText: statusEl ? statusEl.textContent : null,
      }
    })
    throw new Error(`subscribe did not complete: ${JSON.stringify(diag)}`)
  }
  assert('subscribed via real button (UI flipped to "Turn off")', true)

  const endpoint = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration()
    const sub = reg && (await reg.pushManager.getSubscription())
    return sub ? sub.endpoint : null
  })
  assert('PushManager subscription exists', Boolean(endpoint), endpoint ? 'endpoint host: ' + new URL(endpoint).host : 'none')

  // ---- 4. subscription row landed in Supabase --------------------------------
  await new Promise((r) => setTimeout(r, 1500))
  const { data: subRows } = await service.from('web_push_subscriptions').select('id, endpoint').eq('user_id', userId)
  const rowMatch = (subRows || []).some((r) => r.endpoint === endpoint)
  assert('subscription persisted in web_push_subscriptions (RLS row)', rowMatch, `${(subRows || []).length} row(s) for user`)

  // ---- 5. real order + real status change (trigger path) ----------------------
  const ord = await service.from('orders').insert({
    user_id: userId,
    items: [{ name: 'Live push test rover', quantity: 1, price: 1 }],
    total_npr: 1, status: 'pending', provider: 'cod',
    customer_name: 'Live Push Test', email,
  }).select().single()
  if (ord.error) throw new Error('insert order: ' + ord.error.message)
  orderId = ord.data.id

  // Arm in-page detection: listen for SW messages + poll shown notifications.
  await page.evaluate(() => {
    window.__pushArrived = null
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'PUSH_RECEIVED') window.__pushArrived = event.data.payload
    })
  })
  const upd = await service.from('orders').update({ status: 'paid' }).eq('id', orderId)
  if (upd.error) throw new Error('update order: ' + upd.error.message)
  console.log('order status changed → trigger fired; waiting for the push in the browser…')

  let payload = null
  for (let i = 0; i < 20 && !payload; i++) {
    await new Promise((r) => setTimeout(r, 1000))
    payload = await page.evaluate(() => window.__pushArrived)
    if (!payload) {
      payload = await page.evaluate(async () => {
        const reg = await navigator.serviceWorker.getRegistration()
        if (!reg) return null
        const list = await reg.getNotifications({ tag: 'order-status' })
        return list.length ? { title: list[0].title, body: list[0].body } : null
      })
    }
  }
  assert('REAL push arrived in the browser service worker', Boolean(payload), payload ? `title="${payload.title}" body="${payload.body}"` : 'not detected within 20s')
  const contentOk = payload && /rover|payment/i.test((payload.title || '') + (payload.body || ''))
  assert('payload matches the order-status message', Boolean(contentOk), payload ? JSON.stringify(payload).slice(0, 120) : '')
} catch (error) {
  console.error('TEST ERROR:', error.message)
  results.push({ name: 'no fatal error', ok: false })
} finally {
  // ---- cleanup ----------------------------------------------------------------
  try {
    if (userId) {
      await service.from('web_push_subscriptions').delete().eq('user_id', userId)
      if (orderId) await service.from('orders').delete().eq('id', orderId)
      await service.auth.admin.deleteUser(userId)
      console.log('cleanup: subscription, order, and user removed')
    }
  } catch (e) {
    console.error('cleanup error:', e.message)
  }
  if (browser) await browser.close().catch(() => undefined)
  const failed = results.filter((r) => !r.ok)
  console.log(failed.length === 0 ? '\nRESULT: ALL CHECKS PASSED ✅' : `\nRESULT: ${failed.length} CHECK(S) FAILED ❌`)
  process.exit(failed.length === 0 ? 0 : 1)
}
