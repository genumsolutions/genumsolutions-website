// =====================================================================
// tier-robot-e2e.mjs — LIVE end-to-end verification of the
// user-tier + robot_user_settings feature against PRODUCTION.
//
// What it does, in order:
//   1. Creates two disposable users (auth admin API; `.invalid` emails)
//      and provisions the admin one via the service role exactly like
//      admin-set-role does: role='admin' + tier='pro'.
//   2. Signs in through the REAL /api/auth/login from inside the real
//      Chrome (sessions live in the browser cookie jar — no headers
//      crafted by the harness; that is what a real client does).
//   3. Exercises every robot-settings path as admin: seed, read (own +
//      cross-user), sanitizer shape guard, cross-user write, delete,
//      and the tier API's method-not-allowed negative check.
//   4. Signs in as the free customer: free tier, sees the row the
//      admin wrote for them, own-row CRUD roundtrip, cross-user
//      rejection (403).
//   5. Signs out and verifies the API is fully closed (401).
//   6. Cleans EVERYTHING up (rows + both users) unless E2E_KEEP=1.
//
// Run:  node scripts/tier-robot-e2e.mjs
// Needs .env.local: SUPABASE_* keys (already present).
// =====================================================================
import { readFileSync } from 'node:fs'
import puppeteer from 'puppeteer-core'
import { createClient } from '@supabase/supabase-js'
import { purgeTestUsers } from './e2e-helpers.mjs'

const env = {}
for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/)
  if (m) env[m[1]] = (m[2] || '').replace(/^["']|["']$/g, '')
}
const BASE = process.env.E2E_BASE_URL || 'https://genumsolutions-website.vercel.app'
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const KEEP = process.env.E2E_KEEP === '1'
const rand = Math.random().toString(36).slice(2, 10)
const CUSTOMER_EMAIL = `tier-e2e-cust-${rand}@genumtest.invalid`
const ADMIN_EMAIL = `tier-e2e-admin-${rand}@genumtest.invalid`
const PASSWORD = 'Xk9!' + rand + 'Zq'

const service = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

let customerId, adminId, browser, page
const results = []
const assert = (name, ok, detail = '') => {
  results.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

await purgeTestUsers(service)

// All API calls run INSIDE the page context so the browser cookie jar
// carries the session — the same mechanism a real signed-in user uses.
async function api(method, path, body = null) {
  return page.evaluate(
    async (url, method, path, body) => {
      const r = await fetch(url + path, {
        method,
        headers: body !== null ? { 'Content-Type': 'application/json' } : {},
        body: body === null ? undefined : JSON.stringify(body),
      })
      let json = null
      try { json = await r.json() } catch {}
      return { status: r.status, json }
    },
    BASE,
    method,
    path,
    body,
  )
}

async function signIn(email, password) {
  await page.goto(BASE + '/login', { waitUntil: 'networkidle2' })
  const r = await page.evaluate(
    async (email, password) => {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      return res.status
    },
    email,
    password,
  )
  return r
}

async function signOut() {
  await page.goto(BASE + '/', { waitUntil: 'networkidle2' })
  return page.evaluate(async () => (await fetch('/api/auth/logout', { method: 'POST' })).status)
}

try {
  // ---- 1. disposable users + service-role provisioning -------------------------
  const cu = await service.auth.admin.createUser({ email: CUSTOMER_EMAIL, password: PASSWORD, email_confirm: true })
  if (cu.error) throw new Error('createUser(customer): ' + cu.error.message)
  customerId = cu.data.user.id
  const au = await service.auth.admin.createUser({ email: ADMIN_EMAIL, password: PASSWORD, email_confirm: true })
  if (au.error) throw new Error('createUser(admin): ' + au.error.message)
  adminId = au.data.user.id
  console.log(`test users:\n  customer: ${CUSTOMER_EMAIL}\n  admin:    ${ADMIN_EMAIL}`)

  const { error: provErr } = await service.from('profiles').update({ role: 'admin', tier: 'pro' }).eq('id', adminId)
  assert('service-role provisioning (role=admin + tier=pro)', !provErr, provErr?.message)
  const { data: prof } = await service.from('profiles').select('tier, role').eq('id', adminId).maybeSingle()
  assert('provisioning persisted — tier=pro role=admin', prof?.tier === 'pro' && prof?.role === 'admin', `tier=${prof?.tier} role=${prof?.role}`)

  // ---- 2. real browser; sign in as the admin -----------------------------------
  browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-first-run', '--disable-features=Translate', '--disable-blink-features=AutomationControlled'],
  })
  page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 900 })
  page.setDefaultTimeout(30000)

  const adminLogin = await signIn(ADMIN_EMAIL, PASSWORD)
  assert('admin sign-in via /api/auth/login (200)', adminLogin === 200, `HTTP ${adminLogin}`)

  const tierResp = await api('GET', '/api/user/tier')
  assert('admin /api/user/tier → pro', tierResp.status === 200 && tierResp.json?.tier === 'pro', JSON.stringify(tierResp.json))

  // ---- 3. robot settings as admin -----------------------------------------------
  const put1 = await api('PUT', '/api/user/robot-settings', {
    robotId: 'robocar-2wd',
    robotName: '2WD Car v1.0.10',
    settings: { maxSpeed: 220, steerTrim: 4, telemetryChannels: ['battery', 'us_distance', 'ir_line'], notes: 'bench profile' },
  })
  assert('admin PUT own robot row (robocar-2wd)', put1.status === 200, JSON.stringify(put1.json))

  const put2 = await api('PUT', '/api/user/robot-settings', {
    robotId: 'drone-x1',
    robotName: 'Drone X1',
    settings: { hoverPidKp: 1.4, hoverPidKd: 0.2, telemetryChannels: ['altitude', 'imu'] },
  })
  assert('admin PUT own robot row (drone-x1)', put2.status === 200, JSON.stringify(put2.json))

  const own = await api('GET', '/api/user/robot-settings')
  assert('admin GET own robots (2 rows, name-ordered)',
    own.status === 200 && Array.isArray(own.json?.robots) && own.json.robots.length === 2 &&
    own.json.robots[0]?.robot_id === 'robocar-2wd',
    JSON.stringify(own.json?.robots?.map((r) => r.robot_id)))

  const row1 = own.json?.robots?.find((r) => r.robot_id === 'robocar-2wd')
  const roundtripOk = row1 && row1.settings.maxSpeed === 220 && Array.isArray(row1.settings.telemetryChannels) &&
    row1.settings.telemetryChannels.length === 3
  assert('settings JSON round-trips (scalars + string arrays)', Boolean(roundtripOk), JSON.stringify(row1?.settings))

  await api('PUT', '/api/user/robot-settings', {
    robotId: 'junk-robot',
    robotName: 'Junk',
    settings: { okValue: 42, 'bad key!': 'dropped', nested: { deep: 1 }, tooLong: 'x'.repeat(5000), arr: ['fine', 123] },
  })
  const junk = await api('GET', '/api/user/robot-settings')
  const junkRow = junk.json?.robots?.find((r) => r.robot_id === 'junk-robot')
  const junkKeys = junkRow ? Object.keys(junkRow.settings) : []
  const junkOk = junkRow && junkRow.settings.okValue === 42 && junkKeys.length === 1
  assert('shape guard drops non-scalar/array junk, keeps valid keys', Boolean(junkOk), `kept keys: ${junkKeys.join(', ') || '(none)'}`)
  await api('DELETE', '/api/user/robot-settings?userId=' + adminId + '&robotId=junk-robot')

  const xput = await api('PUT', '/api/user/robot-settings', {
    userId: customerId, robotId: 'robocar-2wd', robotName: '2WD Car v1.0.10', settings: { maxSpeed: 180, preset: 'bench' },
  })
  assert('admin cross-user PUT (writes customer row)', xput.status === 200, JSON.stringify(xput.json))

  const xget = await api('GET', '/api/user/robot-settings?userId=' + customerId)
  assert('admin cross-user GET (reads any user rows)',
    xget.status === 200 && xget.json?.robots?.some((r) => r.robot_id === 'robocar-2wd'),
    `rows=${xget.json?.robots?.length}`)

  const promote = await api('PUT', '/api/user/tier', { tier: 'pro' })
  assert('tier API rejects self-service writes (HTTP 405, GET-only route)', promote.status === 405, `HTTP ${promote.status}`)

  const del = await api('DELETE', '/api/user/robot-settings?userId=' + adminId + '&robotId=drone-x1')
  const afterDel = await api('GET', '/api/user/robot-settings')
  assert('admin DELETE own robot row (gone on re-read)',
    del.status === 200 && afterDel.json?.robots?.every((r) => r.robot_id !== 'drone-x1'),
    `rows=${afterDel.json?.robots?.length}`)

  // ---- 4. free customer ----------------------------------------------------------
  const out1 = await signOut()
  const custLogin = await signIn(CUSTOMER_EMAIL, PASSWORD)
  const custTier = await api('GET', '/api/user/tier')
  assert('admin signed out + customer signed in (tier flips pro→free)',
    out1 === 200 && custLogin === 200 && custTier.json?.tier === 'free',
    `logout=${out1} login=${custLogin} tier=${JSON.stringify(custTier.json)}`)

  const custOwn = await api('GET', '/api/user/robot-settings')
  const adminWroteRow = custOwn.json?.robots?.find((r) => r.robot_id === 'robocar-2wd')
  assert('customer sees the robot row the admin wrote for them',
    custOwn.status === 200 && Boolean(adminWroteRow) && adminWroteRow.settings.maxSpeed === 180,
    JSON.stringify(adminWroteRow?.settings))

  // Tier lifecycle: as a FREE user the pro gate must refuse writes…
  const freePut = await api('PUT', '/api/user/robot-settings', {
    robotId: 'balance-bot',
    robotName: 'Balance Bot v1.2.5',
    settings: { kp: 18.5, ki: 0.8, kd: 2.2, telemetryChannels: ['angle', 'battery'] },
  })
  assert('free customer PUT rejected by the pro gate (403 + message)',
    freePut.status === 403 && /pro feature/i.test(String(freePut.json?.error)),
    `HTTP ${freePut.status} ${freePut.json?.error || ''}`)

  // …after the admin flips them to Pro, the same write succeeds and persists.
  const { error: upErr } = await service.from('profiles').update({ tier: 'pro' }).eq('id', customerId)
  assert('admin promotes customer free→pro via service role', !upErr, upErr?.message)
  const proPut = await api('PUT', '/api/user/robot-settings', {
    robotId: 'balance-bot',
    robotName: 'Balance Bot v1.2.5',
    settings: { kp: 18.5, ki: 0.8, kd: 2.2, telemetryChannels: ['angle', 'battery'] },
  })
  const custGet = await api('GET', '/api/user/robot-settings')
  assert('pro customer own-row PUT + persist (roundtrip)',
    proPut.status === 200 && custGet.json?.robots?.length === 2 &&
    custGet.json.robots.find((r) => r.robot_id === 'balance-bot')?.settings.kp === 18.5,
    `HTTP ${proPut.status} rows=${custGet.json?.robots?.length}`)

  const crossRead = await api('GET', '/api/user/robot-settings?userId=' + adminId)
  assert('customer cross-user GET rejected (403)', crossRead.status === 403, `HTTP ${crossRead.status}`)

  const crossWrite = await api('PUT', '/api/user/robot-settings', {
    userId: adminId, robotId: 'hijack', robotName: 'nope', settings: { x: 1 },
  })
  assert('customer cross-user PUT rejected (403)', crossWrite.status === 403, `HTTP ${crossWrite.status}`)

  // ---- 5. fully closed when signed out -------------------------------------------
  const out2 = await signOut()
  const unauth = await api('GET', '/api/user/robot-settings')
  assert('signed-out GET rejected (401)', out2 === 200 && unauth.status === 401, `logout=${out2} HTTP ${unauth.status}`)
} catch (err) {
  assert('harness completed without crash', false, String(err).slice(0, 300))
} finally {
  // ---- 6. cleanup -----------------------------------------------------------------
  if (browser) await browser.close().catch(() => {})
  if (!KEEP) {
    for (const uid of [customerId, adminId].filter(Boolean)) {
      await service.from('robot_user_settings').delete().eq('user_id', uid)
    }
    for (const [label, uid] of [['customer', customerId], ['admin', adminId]]) {
      if (uid) {
        const { error } = await service.auth.admin.deleteUser(uid)
        assert(`cleanup: ${label} user + rows removed`, !error, error?.message)
      }
    }
  } else {
    console.log(`E2E_KEEP=1 — kept users ${CUSTOMER_EMAIL} / ${ADMIN_EMAIL}`)
  }
  const failed = results.filter((r) => !r.ok)
  console.log(failed.length === 0 ? '\nRESULT: ALL CHECKS PASSED ✅' : `\nRESULT: ${failed.length} CHECK(S) FAILED ❌`)
  process.exit(failed.length === 0 ? 0 : 1)
}
