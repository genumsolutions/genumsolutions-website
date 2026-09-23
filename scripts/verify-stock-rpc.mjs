// =====================================================================
// verify-stock-rpc.mjs — LIVE verification of the C1 stock engine
// (schema.sql: adjust_order_stock / mark_order_paid / restore_order_stock)
// against PRODUCTION.
//
// Provisions a disposable STAFF user + a probe product, then exercises the
// RPCs exactly like the app/server do (supabase.rpc under a real JWT):
//   1. adjust_order_stock decrement clamps at 0
//   2. adjust_order_stock restore adds back
//   3. bad direction rejected
//   4. customer JWT rejected (staff gate)
//   5. mark_order_paid on a pending probe order -> true + stock decremented
//   6. mark_order_paid re-run -> false, stock NOT double-decremented
//   7. mark_order_paid on missing order -> false
//   8. restore_order_stock paid -> cancelled restores stock
//   9. restore_order_stock re-run -> no-op (already cancelled)
//  10. restore_order_stock with expect_status=paid on a pending order -> no-op
// Cleans up the probe order/product/user at the end (E2E_KEEP=1 to keep).
//
// Run: node scripts/verify-stock-rpc.mjs
// Needs .env.local: NEXT_PUBLIC_SUPABASE_URL + anon + service role keys.
// =====================================================================
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = {}
for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/)
  if (m) env[m[1]] = (m[2] || '').replace(/^["']|["']$/g, '')
}

const URL = env.NEXT_PUBLIC_SUPABASE_URL
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SVC = env.SUPABASE_SERVICE_ROLE_KEY
const KEEP = process.env.E2E_KEEP === '1'
const rand = Math.random().toString(36).slice(2, 8)
const STAFF_EMAIL = `stock-rpc-probe-staff-${rand}@genumtest.invalid`
const CUSTOMER_EMAIL = `stock-rpc-probe-cust-${rand}@genumtest.invalid`
const PASSWORD = 'Xk9!' + rand + 'Zq'
const PRODUCT_ID = `stock-rpc-probe-${rand}`
const ORDER_NOTE = 'verify-stock-rpc probe order'

const svc = createClient(URL, SVC, { auth: { autoRefreshToken: false, persistSession: false } })
const anon = createClient(URL, ANON, { auth: { autoRefreshToken: false, persistSession: false } })

const results = []
const assert = (name, ok, detail = '') => {
  results.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

async function provision(role, email) {
  const { data, error } = await svc.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  })
  if (error) throw error
  const uid = data?.user?.id
  if (!uid) throw new Error(`createUser(${role}) returned no user.id`)
  const { error: provErr } = await svc.from('profiles').update({ role }).eq('id', uid)
  if (provErr) throw provErr
  const { data: sess, error: signInError } = await anon.auth.signInWithPassword({ email, password: PASSWORD })
  if (signInError) throw signInError
  return { id: uid, token: sess.session.access_token }
}

async function stockOf(productId) {
  const { data } = await svc.from('products').select('stock').eq('id', productId).maybeSingle()
  return data?.stock
}

let staff, customer, orderId
try {
  staff = await provision('staff', STAFF_EMAIL)
  customer = await provision('customer', CUSTOMER_EMAIL)

  // Probe product, stock = 5.
  const { error: prodErr } = await svc.from('products').insert({
    id: PRODUCT_ID,
    name: 'Stock RPC Probe',
    category: 'Test & Tools',
    price: 100,
    stock: 5,
    active: true,
    sort_order: 1000,
  })
  if (prodErr) throw prodErr

  // Probe order (pending) owned by the customer user.
  const items = [{ productId: PRODUCT_ID, name: 'Stock RPC Probe', price: 100, quantity: 2 }]
  const { data: order, error: orderErr } = await svc.from('orders').insert({
    user_id: customer.id,
    items,
    total_npr: 200,
    status: 'pending',
    provider: 'cod',
    customer_name: 'Stock RPC Probe',
    email: CUSTOMER_EMAIL,
  }).select().single()
  if (orderErr) throw orderErr
  orderId = order.id

  const staffDb = createClient(URL, ANON, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${staff.token}` } },
  })
  const custDb = createClient(URL, ANON, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${customer.token}` } },
  })

  // --- adjust_order_stock -------------------------------------------------
  // 1. decrement 2 on stock-5 product -> 3
  await staffDb.rpc('adjust_order_stock', { order_items: items, direction: 'decrement' })
  assert('decrement subtracts ordered quantity', (await stockOf(PRODUCT_ID)) === 3, `stock=${await stockOf(PRODUCT_ID)}`)

  // 1b. clamp: decrement 99 on stock 3 -> 0 (never negative)
  await staffDb.rpc('adjust_order_stock', { order_items: [{ productId: PRODUCT_ID, name: 'x', price: 1, quantity: 99 }], direction: 'decrement' })
  assert('decrement clamps at zero', (await stockOf(PRODUCT_ID)) === 0, `stock=${await stockOf(PRODUCT_ID)}`)

  // 2. restore 2 -> back to 2
  await staffDb.rpc('adjust_order_stock', { order_items: items, direction: 'restore' })
  assert('restore adds back', (await stockOf(PRODUCT_ID)) === 2, `stock=${await stockOf(PRODUCT_ID)}`)

  // 3. bad direction rejected
  const bad = await staffDb.rpc('adjust_order_stock', { order_items: items, direction: 'sideways' })
  assert('bad direction rejected', Boolean(bad.error), bad.error?.message || 'no error')

  // 4. customer JWT rejected (staff gate)
  const asCust = await custDb.rpc('adjust_order_stock', { order_items: items, direction: 'restore' })
  assert('customer rejected (staff gate)', Boolean(asCust.error), asCust.error?.message || 'no error')

  // --- mark_order_paid ----------------------------------------------------
  // 5. pending -> paid: true, stock 2 -> 0
  const pay1 = await staffDb.rpc('mark_order_paid', { order_id: orderId })
  assert('mark_order_paid transition (true)', pay1.data === true, `got ${pay1.data} ${pay1.error?.message || ''}`)
  assert('paid order decremented stock', (await stockOf(PRODUCT_ID)) === 0, `stock=${await stockOf(PRODUCT_ID)}`)
  const { data: paidRow } = await svc.from('orders').select('status').eq('id', orderId).maybeSingle()
  assert('order row now paid', paidRow?.status === 'paid', `status=${paidRow?.status}`)

  // 6. re-run: false, stock stays 0 (idempotent)
  const pay2 = await staffDb.rpc('mark_order_paid', { order_id: orderId })
  assert('mark_order_paid re-run (false)', pay2.data === false && !pay2.error, `got ${pay2.data}`)
  assert('re-run did not double-decrement', (await stockOf(PRODUCT_ID)) === 0, `stock=${await stockOf(PRODUCT_ID)}`)

  // 7. missing order -> false (no throw)
  const pay3 = await staffDb.rpc('mark_order_paid', { order_id: '00000000-0000-4000-8000-000000000000' })
  assert('mark_order_paid missing order (false)', pay3.data === false && !pay3.error, `got ${pay3.data}`)

  // --- restore_order_stock ------------------------------------------------
  // 8. paid -> cancelled: restores 2 AND flips the order to cancelled (atomic)
  const res1 = await staffDb.rpc('restore_order_stock', { order_id: orderId, expect_status: 'paid' })
  const { data: cancelledRow } = await svc.from('orders').select('status').eq('id', orderId).maybeSingle()
  assert('restore on cancel restores stock', res1.data === 1 && (await stockOf(PRODUCT_ID)) === 2, `rows=${res1.data} stock=${await stockOf(PRODUCT_ID)}`)
  assert('restore flipped order to cancelled', cancelledRow?.status === 'cancelled', `status=${cancelledRow?.status}`)

  // 9. re-run with same expect_status: row is 'cancelled' now -> 0 rows, stock intact
  const res2 = await staffDb.rpc('restore_order_stock', { order_id: orderId, expect_status: 'paid' })
  assert('restore re-run no-ops', res2.data === 0 && (await stockOf(PRODUCT_ID)) === 2, `rows=${res2.data} stock=${await stockOf(PRODUCT_ID)}`)

  // 10. expect_status=paid on a never-paid pending order -> no-op
  const { data: ord2 } = await svc.from('orders').insert({
    user_id: customer.id,
    items,
    total_npr: 200,
    status: 'pending',
    provider: 'cod',
    customer_name: 'Stock RPC Probe 2',
    email: CUSTOMER_EMAIL,
  }).select().single()
  const res3 = await staffDb.rpc('restore_order_stock', { order_id: ord2.id, expect_status: 'paid' })
  assert('restore on pending order no-ops', res3.data === 0 && (await stockOf(PRODUCT_ID)) === 2, `rows=${res3.data} stock=${await stockOf(PRODUCT_ID)}`)
  orderId = ord2.id // cleanup the second probe order too
} catch (e) {
  assert('THREW', false, e.message)
} finally {
  if (!KEEP) {
    try { await svc.from('orders').delete().eq('email', CUSTOMER_EMAIL) } catch { /* ignore */ }
    try { await svc.from('products').delete().eq('id', PRODUCT_ID) } catch { /* ignore */ }
    if (staff) await svc.auth.admin.deleteUser(staff.id)
    if (customer) await svc.auth.admin.deleteUser(customer.id)
  }
  const pass = results.filter((r) => r.ok).length
  console.log(`\n${pass}/${results.length} checks passed`)
  process.exit(pass === results.length ? 0 : 1)
}
