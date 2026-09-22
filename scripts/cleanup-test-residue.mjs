// =====================================================================
// cleanup-test-residue.mjs — remove LIVE database test residue left by
// the E2E harnesses (tier-robot, admin-set-role, p3-review stage users
// and COD probe orders) so nothing test-related shows in the admin UI.
//
// What it matches:
//   - auth users whose email ends `@genumtest.invalid` (harness fixtures)
//   - orders placed BY those users, plus any order that is a P3 smoke
//     probe (provider_ref or items reference "smoke probe")
//
// Deletes (service role):
//   - the matching orders (transactions cascade via orders.id; carts,
//     robot_user_settings, user_settings, push tokens, web push
//     subscriptions cascade via auth.users.id)
//   - the matching auth users with `admin.deleteUser` (profiles + carts +
//     orders cascade from auth.users.id; messages/activity/page_views set
//     null)
//
// SAFETY: dry-run by default. Pass `--apply` to actually delete. The real
// accounts (genumsolutions, nijandangal*, Shankar airi, Shankhamool Art)
// are never matched because their emails are not `@genumtest.invalid`.
//
// Run:  node scripts/cleanup-test-residue.mjs [--apply]
// Needs .env.local: SUPABASE_* keys (already present).
// =====================================================================
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = {}
for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/)
  if (m) env[m[1]] = (m[2] || '').replace(/^["']|["']$/g, '')
}

const APPLY = process.argv.includes('--apply')
const service = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ---- scan candidate users + orders ---------------------------------------------
const { data: users, error: usersErr } = await service.auth.admin.listUsers({ perPage: 1000 })
if (usersErr) throw new Error('listUsers: ' + usersErr.message)
const testUsers = (users?.users ?? []).filter((u) => u.email?.toLowerCase().endsWith('@genumtest.invalid'))
const testUserIds = new Set(testUsers.map((u) => u.id))

const orders = []
const smiles = ['%@genumtest.invalid%', '%smoke probe%']
for (const like of smiles) {
  const { data, error } = await service.from('orders').select('id,user_id,status,provider,provider_ref,customer_name,email,items,created_at').ilike(filterField(like), like)
  if (error) throw new Error(`order scan (${like}): ` + error.message)
  for (const row of data || []) if (!orders.some((o) => o.id === row.id)) orders.push(row)
}

function filterField(like) {
  // provider_ref and the items blob are the two places harnesses mark probes
  return like.includes('@') ? 'email' : 'provider_ref'
}

const byUser = orders.filter((o) => testUserIds.has(o.user_id))
const byMark = orders.filter((o) => !testUserIds.has(o.user_id) && isSmokeProbe(o))

function isSmokeProbe(o) {
  const items = Array.isArray(o.items) ? JSON.stringify(o.items).toLowerCase() : ''
  return (o.provider_ref || '').toLowerCase().includes('smoke') || items.includes('smoke probe')
}

console.log(`scan: ${(users?.users ?? []).length} auth users total · ${testUsers.length} @genumtest.invalid`)
console.log(`scan: ${orders.length} candidate orders (${byUser.length} from test users, ${byMark.length} marked smoke probes)`)

if (!APPLY) {
  console.log('\nDRY RUN — pass --apply to delete. Would remove:')
  for (const u of testUsers) console.log(`  user ${u.id}  ${u.email}  role=${u.role}  created=${u.created_at ?? ''}`.slice(0, 160))
  for (const o of orders) console.log(`  order ${o.id}  status=${o.status} provider=${o.provider} ref=${o.provider_ref || ''} by=${o.user_id}`.slice(0, 160))
  const { count } = await service.from('orders').select('*', { count: 'exact', head: true })
  const profiles = await service.from('profiles').select('id,email', { count: 'exact', head: true })
  console.log(`\nwould be left: orders=${count} profiles=${profiles.count} (before cleanup)`)
  process.exit(0)
}

// ---- actually delete ------------------------------------------------------------
let deletedOrders = 0
let deletedUsers = 0
for (const o of orders) {
  const { error } = await service.from('orders').delete().eq('id', o.id)
  if (error) { console.error(`  delete order ${o.id} FAILED: ${error.message}`); continue }
  deletedOrders++
}
for (const u of testUsers) {
  const { error } = await service.auth.admin.deleteUser(u.id)
  if (error) { console.error(`  delete user ${u.email} FAILED: ${error.message}`); continue }
  deletedUsers++
}
console.log(`\nAPPLIED: deleted ${deletedUsers} users + ${deletedOrders} orders`)

// ---- verify ---------------------------------------------------------------------
const after = (await service.auth.admin.listUsers({ perPage: 1000 })).data?.users ?? []
const remainUsers = (after || []).filter((u) => u.email?.toLowerCase().endsWith('@genumtest.invalid'))
const remainOrders = []
for (const like of ['%@genumtest.invalid%', '%smoke probe%']) {
  const { data } = await service.from('orders').select('id,email,provider_ref').ilike(filterField(like), like)
  for (const row of data || []) if (!remainOrders.some((o) => o.id === row.id)) remainOrders.push(row)
}
const clean = remainUsers.length === 0 && remainOrders.length === 0
console.log(`verify: ${remainUsers.length} test users · ${remainOrders.length} probe orders remaining`)
console.log(clean ? '\nRESULT: RESIDUE CLEAN ✅' : '\nRESULT: residue still present ❌')
process.exit(clean ? 0 : 1)