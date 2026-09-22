// =====================================================================
// p3-review.mjs — automated portion of the owner's P3 design review
// (guide/P3-REVIEW-CHECKLIST-2026-09-21.md), run against PRODUCTION.
//
// Discipline: this is a REVIEW — nothing is fixed mid-run. Any failure
// is reported as a SNAG for the owner. All test data (users, orders,
// cart lines, subscriptions, curriculum probe) is cleaned up after.
//
// Run:  node scripts/p3-review.mjs
// =====================================================================
import { readFileSync } from 'node:fs'
import puppeteer from 'puppeteer-core'
import { createClient } from '@supabase/supabase-js'

const env = {}
for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/)
  if (m) env[m[1]] = (m[2] || '').replace(/^["']|["']$/g, '')
}
const BASE = process.env.E2E_BASE_URL || 'https://genumsolutions-website.vercel.app'
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const rand = Math.random().toString(36).slice(2, 10)
const EMAIL = `p3-cust-${rand}@genumtest.invalid`
const ADMIN_EMAIL = `p3-admin-${rand}@genumtest.invalid`
const PASSWORD = 'Xk9!' + rand + 'Zq'

const service = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const lines = []
const report = (section, item, status, note = '') => {
  lines.push({ section, item, status, note })
  console.log(`[${status.padEnd(5)}] §${section} ${item}${note ? ' — ' + note : ''}`)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let browser, custId, adminId, orderId, customerOrderId, probeId
const results = []

try {
  browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-first-run', '--disable-blink-features=AutomationControlled'],
  })
  await browser.defaultBrowserContext().overridePermissions(BASE, ['notifications'])
  let page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 900 })

  // ---------- fixture: two disposable users (customer + admin) ----------
  const cu = await service.auth.admin.createUser({ email: EMAIL, password: PASSWORD, email_confirm: true })
  if (cu.error) throw new Error('createUser: ' + cu.error.message)
  custId = cu.data.user.id
  const au = await service.auth.admin.createUser({ email: ADMIN_EMAIL, password: PASSWORD, email_confirm: true })
  if (au.error) throw new Error('createAdmin: ' + au.error.message)
  adminId = au.data.user.id
  await service.from('profiles').upsert({ id: adminId, role: 'admin' })

  // API sign-in helper (the same endpoint the real form posts to), then reload.
  // Throws unless the login returns 200 AND /api/auth/session confirms the
  // identity — a silently failed login must never cascade into vacuous FAILs.
  async function login(p, email) {
    const status = await p.evaluate(async (e, pw) => {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: e, password: pw }),
      })
      return res.status
    }, email, PASSWORD)
    await p.goto(BASE + '/', { waitUntil: 'networkidle2' })
    let session = null
    for (let i = 0; i < 4; i++) {
      try {
        session = await p.evaluate(async () => {
          const res = await fetch('/api/auth/session')
          return res.json().catch(() => null)
        })
        break
      } catch {
        await sleep(1200)
      }
    }
    if (status !== 200 || session?.user?.email !== email) {
      throw new Error(`login failed for ${email} (api=${status}, session=${JSON.stringify(session).slice(0, 140)})`)
    }
    return session.user
  }

  // ================= SECTION 1 — storefront + unification =================
  {
    const db = await service.from('curriculum_highlights').select('age_band, items').eq('active', true).limit(1).single()
    const probe = (db.data?.items || []).find(Boolean)
    await page.goto(BASE + '/', { waitUntil: 'networkidle2' })
    const homeText = await page.evaluate(() => document.body.innerText)
    const hasCurriculum = probe ? homeText.includes(probe) : false
    report(1, 'Home renders curriculum highlights from shared tables', hasCurriculum ? 'PASS' : 'FAIL',
      hasCurriculum ? `found DB item "${probe}"` : 'no DB curriculum item found on page')
  }
  {
    await page.goto(BASE + '/tools', { waitUntil: 'networkidle2' })
    const fleet = await page.evaluate(() => document.body.innerText)
    const chips = (fleet.match(/MODE\s*\d\s*\/\s*9/gi) || []).length
    report(1, '/tools fleet catalogue: 9 MODE n/9 chips', chips >= 9 ? 'PASS' : 'FAIL', `${chips} chips found`)
    report(1, '/tools D-1 parked note readable', /parked|remote control/i.test(fleet) ? 'PASS' : 'SNAG', 'visual wording check recommended')
  }
  {
    await login(page, EMAIL) // customer session suffices for /admin read? admin tabs need admin; use admin
  }
  {
    // sign in as ADMIN for /admin checks (session-verified)
    await login(page, ADMIN_EMAIL)
    await page.goto(BASE + '/admin', { waitUntil: 'networkidle2' })
    const tabs = await page.evaluate(() => {
      const wanted = ['Dashboard', 'Orders', 'Products', 'Projects', 'Services', 'Journal', 'Users', 'Messages', 'Finance', 'Activity', 'Content', 'Settings']
      const seq = [...document.querySelectorAll('button')]
        .map((b) => b.textContent.trim())
        .filter((t) => wanted.includes(t))
      return seq
    })
    const orderOk = tabs.length >= 12 && tabs[0] === 'Dashboard' && tabs.indexOf('Orders') === 1
    report(1, 'Admin tab order: Dashboard-first (W-4b)', orderOk ? 'PASS' : 'SNAG', `first tabs: ${tabs.slice(0, 3).join(' → ')}`)
    // Stats load async — wait for the dashboard fetch to paint its cards.
    try {
      await page.waitForFunction(() => /transactions/i.test(document.body.innerText), { timeout: 20000, polling: 500 })
      report(1, 'Dashboard shows the Transactions card', 'PASS')
    } catch {
      report(1, 'Dashboard shows the Transactions card', 'FAIL', 'card text never rendered within 20s')
    }
  }
  {
    // P2 gate: write a curriculum line via the admin API → visible on home → delete
    const created = await page.evaluate(async () => {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'curriculum', curriculum: { ageBand: 'P3 probe', items: ['P3 review probe line'], active: true, sortOrder: 999 } }),
      })
      return res.status
    })
    let settingsBody = null
    for (let i = 0; i < 4; i++) {
      try {
        settingsBody = await page.evaluate(async () => {
          const res = await fetch('/api/admin/settings')
          return res.json().catch(() => null)
        })
        break
      } catch {
        await sleep(1200)
      }
    }
    probeId = (settingsBody?.curriculum || []).find?.((h) => h?.ageBand === 'P3 probe')?.id || null
    await page.goto(BASE + '/', { waitUntil: 'networkidle2' })
    const homeText = await page.evaluate(() => document.body.innerText)
    const visible = homeText.includes('P3 review probe line')
    report(1, 'P2 gate: admin curriculum edit shows on home', created === 200 && visible ? 'PASS' : 'SNAG',
      created !== 200 ? `settings POST → ${created}` : visible ? 'probe line rendered' : 'probe line not on home')
    // Probe cleanup is done server-side in the finally block (by age_band),
    // which is robust regardless of the GET response shape.
    report(1, 'Curriculum probe written via admin API (cleanup in finally)', created === 200 ? 'PASS' : 'SNAG', `PUT → ${created}`)
  }

  // ================= SECTION 2 — W-6 dark mode =================
  {
    await page.goto(BASE + '/', { waitUntil: 'networkidle2' })
    const readLabel = () => page.evaluate(() => {
      const b = document.querySelector('button[aria-label^="Theme:"]')
      return b ? b.getAttribute('aria-label') : null
    })
    const l0 = await readLabel()
    const cycle = []
    for (let i = 0; i < 2; i++) {
      await page.click('button[aria-label^="Theme:"]')
      await sleep(400)
      cycle.push(await readLabel())
    }
    // 2-mode (owner decision 2026-09-22): light ⇄ dim — a click always flips,
    // the second click returns to the start. No System state exists anymore.
    const seqOk = l0 && /Theme: (light|dim)/.test(l0) &&
      cycle[0] && /Theme: (light|dim)/.test(cycle[0]) && cycle[0] !== l0 &&
      cycle[1] === l0
    report(2, 'Toggle cycles light ⇄ dim (System removed)', seqOk ? 'PASS' : 'SNAG',
      `start="${l0}" then="${cycle.map((c) => (c || '').slice(7, 20)).join('", "').slice(0, 60)}"`)
    // leave on dim for the remaining checks
    if (/Theme: light/.test(l0)) {
      await page.click('button[aria-label^="Theme:"]')
      await sleep(300)
    }
  }
  {
    // 2-mode migration: the removed 'system' (OS-follow) value now resolves to
    // dim on read; a visitor with no stored choice gets light. No OS listener.
    await page.evaluate(() => localStorage.setItem('genum-theme', 'system'))
    await page.reload({ waitUntil: 'networkidle2' })
    const migrated = await page.evaluate(() => document.documentElement.getAttribute('data-theme'))
    await page.evaluate(() => localStorage.removeItem('genum-theme'))
    await page.reload({ waitUntil: 'networkidle2' })
    const fresh = await page.evaluate(() => document.documentElement.getAttribute('data-theme'))
    report(2, '2-mode migration: legacy system → dim, fresh (no stored) → light',
      migrated === 'dim' && fresh === 'light' ? 'PASS' : 'SNAG',
      `stored=system → ${migrated}, no stored → ${fresh}`)
  }
  {
    // No-flash proxy: SSR HTML carries the pre-paint resolver; reload applies dim pre-paint.
    const html = await page.evaluate(async () => await (await fetch(window.location.href)).text())
    const scriptPresent = /setAttribute\('data-theme'/.test(html)
    await page.evaluate(() => localStorage.setItem('genum-theme', 'dim'))
    await page.reload({ waitUntil: 'domcontentloaded' })
    const theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'))
    report(2, 'No-flash: pre-paint script present + dim applied on reload',
      scriptPresent && theme === 'dim' ? 'PASS' : 'SNAG',
      `inline script: ${scriptPresent ? 'yes' : 'NO'}, post-reload data-theme: ${theme} (true flash needs a human eye)`)
  }
  {
    // Dim walk with a contrast sampler (flags hard unreadable text only).
    const pagesToWalk = ['/', '/products', '/tools', '/account', '/checkout', '/admin']
    // ensure the cart has an item so /checkout renders
    const prod = await service.from('products').select('id, price').eq('active', true).limit(1).single()
    await page.evaluate(async (pid) => {
      await fetch('/api/cart', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cart: [{ productId: pid, quantity: 1 }] }),
      })
    }, prod.data?.id)
    let worst = { page: null, violations: -1, warns: 0 }
    const walkNotes = []
    for (const path of pagesToWalk) {
      await page.goto(BASE + path, { waitUntil: 'networkidle2' }).catch(() => undefined)
      if (path === '/admin') {
        // /admin mounts its panels client-side (ssr:false) and fetches stats
        // async — sampling during that window counted half-painted/skeleton
        // rows and produced the P3 snag. Wait until the dashboard actually
        // paints (or 20s out) before sampling.
        await page.waitForFunction(() => /transactions/i.test(document.body.innerText), { timeout: 20000, polling: 500 }).catch(() => undefined)
      }
      const sample = await page.evaluate(() => {
        function lum(r, g, b) {
          const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
          return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
        }
        function parse(c) { const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/); return m ? [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]] : [255, 255, 255, 1] }
        function bgOf(el) {
          let node = el
          while (node && node !== document.documentElement) {
            const c = getComputedStyle(node).backgroundColor
            if (c && !/rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*0\s*\)/.test(c) && c !== 'transparent') return parse(c)
            node = node.parentElement
          }
          return [255, 255, 255, 1]
        }
        let hard = 0, warn = 0, checked = 0
        for (const el of document.querySelectorAll('body *')) {
          if (el.children.length) continue
          const text = (el.textContent || '').trim()
          if (!text) continue
          const cs = getComputedStyle(el)
          if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) continue
          const bg = bgOf(el)
          const fgRaw = parse(cs.color)
          // Composite translucent text over its resolved background — the eye
          // never sees raw rgba channels, so `text-ink/50` must be judged by
          // its blended result, not its un-blended color.
          const a = fgRaw[3]
          const fg = a < 1 ? fgRaw.slice(0, 3).map((v, i) => Math.round(v * a + bg[i] * (1 - a))) : fgRaw.slice(0, 3)
          const L1 = lum(...fg), L2 = lum(bg[0], bg[1], bg[2])
          const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)
          checked++
          if (ratio < 2.0) hard++
          else if (ratio < 3.0) warn++
          if (checked >= 400) break
        }
        const fails = []
        for (const el of document.querySelectorAll('body *')) {
          if (el.children.length) continue
          const text = (el.textContent || '').trim()
          if (!text) continue
          const cs = getComputedStyle(el)
          if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) continue
          const bg = bgOf(el)
          const fgRaw = parse(cs.color)
          const a = fgRaw[3]
          const fg = a < 1 ? fgRaw.slice(0, 3).map((v, i) => Math.round(v * a + bg[i] * (1 - a))) : fgRaw.slice(0, 3)
          const L1 = lum(...fg), L2 = lum(bg[0], bg[1], bg[2])
          const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)
          checked++
          if (ratio < 2.0) {
            hard++
            if (fails.length < 30) fails.push({ tag: el.tagName.toLowerCase(), cls: (el.getAttribute('class') || '').slice(0, 100), color: cs.color, bg: `rgb(${bg.slice(0, 3).join(',')})`, ratio: Math.round(ratio * 100) / 100, text: text.slice(0, 40) })
          }
          else if (ratio < 3.0) warn++
          if (checked >= 400) break
        }
        return { hard, warn, checked, fails, theme: document.documentElement.getAttribute('data-theme') }
      })
      if (process.env.E2E_DUMP_CONTRAST && sample.fails.length) {
        console.log(`   [dump] ${path} hard-fail elements:`)
        for (const f of sample.fails) console.log(`     ratio ${String(f.ratio).padEnd(5)} <${f.tag} class="${f.cls}"> color=${f.color} bg=${f.bg} text="${f.text}"`)
      }
      walkNotes.push(`${path}: ${sample.hard} hard / ${sample.warn} soft of ${sample.checked}`)
      if (sample.hard > worst.violations) worst = { page: path, violations: sample.hard, warns: sample.warn, theme: sample.theme }
    }
    const allDim = true // sampler reported data-theme per page inside notes only; global verdict from worst
    report(2, 'Dim walk: no unreadable text on home/products/tools/account/checkout/admin',
      worst.violations === 0 ? 'PASS' : 'SNAG', walkNotes.join(' · '))
  }
  {
    // Persistence + Supabase shared truth: the toggle lives in SiteHeader,
    // which /admin does not render — go home first, then flip the 2-mode toggle
    // and confirm profiles.theme_preference took exactly that value (light/dim).
    await page.goto(BASE + '/', { waitUntil: 'networkidle2' })
    await page.waitForSelector('button[aria-label^="Theme:"]', { timeout: 20000 })
    const before = await page.evaluate(() => {
      const b = document.querySelector('button[aria-label^="Theme:"]')
      return b ? b.getAttribute('aria-label') : null
    })
    const startsDim = /Theme: dim/.test(before || '')
    await page.click('button[aria-label^="Theme:"]') // flips to the other mode
    await sleep(800)
    const expected = startsDim ? 'light' : 'dim'
    // The cloud write goes to WHOEVER is signed in — resolve the session first.
    const sessionUser = await page.evaluate(async () => {
      const res = await fetch('/api/auth/session')
      return (await res.json().catch(() => null))?.user || null
    })
    const themeUid = sessionUser?.email === ADMIN_EMAIL ? adminId : custId
    const { data: prof } = await service.from('profiles').select('theme_preference').eq('id', themeUid).maybeSingle()
    report(2, 'Theme preference saved to profiles (Supabase shared truth)',
      prof?.theme_preference === expected ? 'PASS' : 'SNAG',
      `profiles.theme_preference = ${prof?.theme_preference} for ${sessionUser?.email} (expected ${expected})`)
    await page.reload({ waitUntil: 'networkidle2' })
    const afterReload = await page.evaluate(() => document.documentElement.getAttribute('data-theme'))
    report(2, 'Preference persists across reload', afterReload === expected ? 'PASS' : 'SNAG',
      `data-theme after reload = ${afterReload} (expected ${expected})`)
  }

  // ================= SECTION 3 — regression smoke =================
  {
    const badge = await page.evaluate(() => {
      const b = document.querySelector('a[aria-label^="Open checkout"]')
      return b ? b.getAttribute('aria-label') : null
    })
    report(3, 'Header cart badge counts items', /Open checkout, 1 item/.test(badge || '') ? 'PASS' : 'SNAG', `aria="${badge}"`)
  }
  {
    const placed = await page.evaluate(async (email) => {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'cod',
          items: [{ productId: '00000000-0000-0000-0000-000000000000', name: 'P3 smoke probe', price: 1, quantity: 1 }],
          customer: { name: 'P3 Smoke', email, phone: '9800000000', address: 'Test, Kathmandu' },
        }),
      })
      const body = await res.json().catch(() => null)
      return { status: res.status, id: body?.orderId || body?.id || body?.order?.id || null }
    }, EMAIL)
    orderId = placed.id
    report(3, 'Cart → checkout → COD order places cleanly', placed.status === 200 && orderId ? 'PASS' : 'FAIL',
      `POST /api/orders → ${placed.status}${orderId ? ', order ' + orderId.slice(0, 8) : ''}${!orderId ? ' (id not parsed — visual confirm recommended)' : ''}`)
  }
  {
    // Sign out via the header account menu (avatar → "Log out"), verified by session.
    // The checkout page client-redirects at an unpredictable delay after an
    // order lands (empty-cart effect) — a goto that intersects that transition
    // kills the JS context, no matter how long we settle first. Bulletproof
    // pattern: abandon that tab entirely and continue in a fresh tab (same
    // session via cookies, immune to the dead tab's pending redirect).
    await page.close().catch(() => undefined)
    const page2 = await browser.newPage()
    await page2.setViewport({ width: 1280, height: 900 })
    await page2.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
    // Rebind `page` for the rest of the run.
    page = page2
    await page.waitForSelector('button[aria-label^="Account menu"]', { timeout: 20000 })
    await page.click('button[aria-label^="Account menu"]')
    await sleep(400)
    const clicked = await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Log out')
      if (b) b.click()
      return Boolean(b)
    })
    await sleep(1200)
    // The log-out flow triggers a client navigation/refresh — wait it out so
    // the session probe below doesn't land mid-navigation (context destroyed).
    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 6000 }).catch(() => undefined)
    await sleep(800)
    let sessionAfter = null
    for (let i = 0; i < 4; i++) {
      try {
        sessionAfter = await page.evaluate(async () => {
          const res = await fetch('/api/auth/session')
          return res.json().catch(() => null)
        })
        break
      } catch {
        await sleep(1200)
      }
    }
    report(3, 'Sign out works (avatar menu → Log out)', clicked && sessionAfter?.user === null ? 'PASS' : 'SNAG',
      `clicked=${clicked}, session=${JSON.stringify(sessionAfter).slice(0, 80)}`)
    await login(page, EMAIL)
    report(3, 'Sign back in works (session verified)', 'PASS')
  }
  {
    await page.setViewport({ width: 390, height: 844 })
    await page.goto(BASE + '/', { waitUntil: 'networkidle2' })
    const mobile = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      buttons: [...document.querySelectorAll('header button')].filter((b) => b.getBoundingClientRect().right <= window.innerWidth + 1).length,
    }))
    report(3, 'Mobile (390px): header fits, no horizontal overflow',
      mobile.overflow <= 1 && mobile.buttons >= 2 ? 'PASS' : 'SNAG',
      `overflow=${mobile.overflow}px, header buttons in view=${mobile.buttons}`)
    await page.setViewport({ width: 1280, height: 900 })
  }

  // ================= SECTION 4 — W-3 push (live) =================
  {
    // customer page listens for SW broadcasts; admin acts from a 2nd context
    let pushPayload = null
    let subscribeSettle = null
    const subscribeDone = new Promise((r) => (subscribeSettle = r))
    page.on('response', (r) => { if (r.url().includes('/api/push/subscribe')) subscribeSettle(r.status()) })
    await page.goto(BASE + '/account', { waitUntil: 'networkidle2' })
    // Arm the in-page listener AFTER navigation (a goto wipes page state).
    await page.evaluate(() => {
      window.__pushArrived = null
      navigator.serviceWorker.addEventListener('message', (e) => {
        if (e.data && e.data.type === 'PUSH_RECEIVED') window.__pushArrived = e.data.payload
      })
    })
    const cardShown = await page.evaluate(() => document.body.innerText.includes('Order notifications'))
    report(4, 'Account shows the "Order notifications" card', cardShown ? 'PASS' : 'FAIL')
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('Turn on notifications'))
      if (b) b.click()
      return Boolean(b)
    })
    try {
      await page.waitForFunction(() => document.body.innerText.includes('Turn off on this device'), { timeout: 45000, polling: 500 })
      report(4, 'Turn on → subscribed (UI flips to "Turn off")', 'PASS')
    } catch {
      report(4, 'Turn on → subscribed', 'FAIL', 'UI never flipped')
    }
    const subStatus = await Promise.race([subscribeDone, sleep(2000).then(() => null)])
    const { data: subs } = await service.from('web_push_subscriptions').select('id').eq('user_id', custId)
    report(4, 'Subscription persisted', (subs || []).length === 1 && subStatus === 200 ? 'PASS' : 'FAIL', `rows=${(subs || []).length}, api=${subStatus}`)

    // admin context fires a real status change from the admin API
    const adminPage = await (await browser.createBrowserContext()).newPage()
    await adminPage.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
    await login(adminPage, ADMIN_EMAIL)
    if (orderId) {
      // The live fire MUST target an order owned by the SUBSCRIBED customer.
      // §3's order belongs to whoever was signed in then (the admin), so
      // create a fresh customer-owned order here via the customer session.
      const custOrder = await page.evaluate(async (email) => {
        const res = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: 'cod',
            items: [{ productId: '00000000-0000-0000-0000-000000000000', name: 'P3 push fire probe', price: 1, quantity: 1 }],
            customer: { name: 'P3 Push Fire', email, phone: '9800000000', address: 'Test, Kathmandu' },
          }),
        })
        const body = await res.json().catch(() => null)
        return { status: res.status, id: body?.orderId || body?.id || body?.order?.id || null }
      }, EMAIL)
      if (custOrder.status !== 200 || !custOrder.id) {
        report(4, 'Live fire: customer order for the push test', 'FAIL', `POST /api/orders → ${custOrder.status}, id=${custOrder.id}`)
      } else {
        customerOrderId = custOrder.id
        const patch = await adminPage.evaluate(async (id) => {
          const res = await fetch('/api/admin/orders', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, status: 'paid' }),
          })
          return res.status
        }, customerOrderId)
        report(4, 'Live fire: admin status change accepted', patch === 200 ? 'PASS' : 'FAIL', `PATCH → ${patch}`)
        for (let i = 0; i < 20 && !pushPayload; i++) {
          await sleep(1000)
          pushPayload = await page.evaluate(() => window.__pushArrived).catch(() => null)
        }
      }
      report(4, 'Notification pops on the subscribed browser', pushPayload ? 'PASS' : 'FAIL',
        pushPayload ? `title="${pushPayload.title}"` : 'no push within 20s')
      report(4, 'Tap notification → opens /account#orders', 'DEFER', 'cannot synthesize a Chrome notification click from automation — one manual tap needed')
      // turn off
      await page.evaluate(() => {
        const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('Turn off on this device'))
        if (b) b.click()
        return Boolean(b)
      })
      await sleep(1500)
      const { data: after } = await service.from('web_push_subscriptions').select('id').eq('user_id', custId)
      report(4, 'Turn off removes the subscription', (after || []).length === 0 ? 'PASS' : 'FAIL', `rows=${(after || []).length}`)
      // opted-out order change on the customer's OTHER order sends nothing.
      // Reset the live-fire latch first — it's still true from the successful
      // push above (same page, no reload), which would false-FAIL this check.
      await page.evaluate(() => { window.__pushArrived = null })
      await adminPage.evaluate(async (id) => {
        await fetch('/api/admin/orders', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, status: 'fulfilled' }),
        })
      }, customerOrderId)
      await sleep(6000)
      const stillNull = await page.evaluate(() => window.__pushArrived).catch(() => null)
      report(4, 'Opted-out: no push sent', !stillNull ? 'PASS' : 'FAIL')
      // customer's push-fire order is deleted in cleanup below
    } else {
      report(4, 'Live fire / turn-off checks', 'SNAG', 'no §3 order id to clone — skipped')
    }
    // checkout opt-in once + "Not now" sticks (needs items in the build list;
    // §3's COD order emptied the cart, so re-add one first)
    const prodForCheckout = await service.from('products').select('id').eq('active', true).limit(1).single()
    await page.evaluate(async (pid) => {
      await fetch('/api/cart', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cart: [{ productId: pid, quantity: 1 }] }),
      })
    }, prodForCheckout.data?.id)
    await page.goto(BASE + '/checkout', { waitUntil: 'networkidle2' })
    // The opt-in card renders only after the component's async readiness
    // checks (SW ready, permission state) resolve — poll for it instead of
    // sampling once at an arbitrary instant.
    let optIn = 0
    for (let i = 0; i < 20; i++) {
      optIn = await page.evaluate(() => (document.body.innerText.match(/Want a push notification/g) || []).length)
      if (optIn > 0) break
      await sleep(500)
    }
    report(4, 'Checkout opt-in appears (once)', optIn === 1 ? 'PASS' : 'SNAG', `${optIn} occurrence(s)`)
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Not now')
      if (b) b.click()
      return Boolean(b)
    })
    await sleep(500)
    const optedOut = await page.evaluate(() => localStorage.getItem('genum-push-optout'))
    await page.reload({ waitUntil: 'networkidle2' })
    // Give the card a fair chance to (wrongly) reappear before declaring it
    // stays away — an instant sample could false-PASS while it's still loading.
    let optInAfter = 0
    for (let i = 0; i < 12; i++) {
      optInAfter = await page.evaluate(() => (document.body.innerText.match(/Want a push notification/g) || []).length)
      if (optInAfter > 0) break
      await sleep(500)
    }
    report(4, '"Not now" makes the opt-in stay away', optedOut === '1' && optInAfter === 0 ? 'PASS' : 'SNAG',
      `optout=${optedOut}, occurrences after reload=${optInAfter}`)
    report(4, 'Denied-permission state explains unblocking', 'DEFER', 'denied state not automatable; source branch verified (PushNotificationSettings.tsx)')
  }

  // ================= cleanup =================
  for (const id of [orderId, customerOrderId].filter(Boolean)) {
    await page.evaluate(async (oid) => { await fetch(`/api/admin/orders?id=${oid}`, { method: 'DELETE' }) }, id).catch(() => undefined)
  }
  // Remove any P3-review curriculum probes from the live home page.
  await service.from('curriculum_highlights').delete().eq('age_band', 'P3 probe')
  await service.from('web_push_subscriptions').delete().eq('user_id', custId)
  await service.from('carts').delete().eq('user_id', custId)
  if (adminId) await service.auth.admin.deleteUser(adminId)
  if (custId) await service.auth.admin.deleteUser(custId)
  console.log('\ncleanup: order (via admin API), subscription, cart, and both test users removed')
} catch (error) {
  console.error('HARNESS ERROR:', error.message)
  if (process.env.E2E_DEBUG) console.error(error.stack)
  results.push(false)
} finally {
  if (browser) await browser.close().catch(() => undefined)
  const bySection = {}
  for (const l of lines) (bySection[l.section] = bySection[l.section] || []).push(l)
  console.log('\n===== P3 REVIEW SUMMARY =====')
  for (const [sec, items] of Object.entries(bySection)) {
    console.log(`§${sec}:`)
    for (const l of items) console.log(`  [${l.status}] ${l.item}${l.note ? ' — ' + l.note : ''}`)
  }
  const failed = lines.filter((l) => l.status === 'FAIL')
  const snagged = lines.filter((l) => l.status === 'SNAG')
  console.log(`\nTOTAL: ${lines.filter((l) => l.status === 'PASS').length} PASS · ${snagged.length} SNAG · ${failed.length} FAIL · ${lines.filter((l) => l.status === 'DEFER').length} DEFER`)
  process.exit(failed.length ? 1 : 0)
}
