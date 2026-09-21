// =====================================================================
// push-order-status — notifies the order's buyer when an order status
// changes (pending -> paid -> fulfilled / cancelled) on BOTH transports:
//
//   1. Web Push (W-3) — standards-based VAPID push to browser
//      subscriptions (web_push_subscriptions table). ACTIVE NOW — needs
//      only NEXT_PUBLIC_VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY secrets.
//      NO Firebase involved.
//   2. Expo push — native app devices (push_tokens table). DORMANT until
//      Firebase is activated (EXPO_ACCESS_TOKEN secret absent = skipped).
//
// Invoked by the database trigger in order-status-push-trigger.sql via
// pg_net with a JSON body: { "orderId": "...", "status": "paid" }.
//
// Deployment (Supabase dashboard or CLI):
//   1. supabase/functions deploy push-order-status
//   2. Set function secrets:
//        NEXT_PUBLIC_VAPID_PUBLIC_KEY  Web Push VAPID public key (b64url).
//                                      REQUIRED for web push.
//        VAPID_PRIVATE_KEY             Web Push VAPID private key (b64url
//                                      PKCS8). REQUIRED for web push.
//        EXPO_ACCESS_TOKEN             Optional — Expo push stays skipped
//                                      until Firebase is activated.
//        PUSH_TRIGGER_SECRET           Optional shared secret. When set,
//                                      the DB trigger must send it as the
//                                      x-push-secret header.
//   3. Run supabase/schema.sql (web_push_subscriptions + push_tokens).
//   4. Run supabase/order-status-push-trigger.sql after enabling pg_net.
// =====================================================================
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { sendWebPush } from './webpush.ts'

const supabaseUrl = Deno.env.get('NEXT_PUBLIC_SUPABASE_URL') || ''
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const vapidPublicKey = Deno.env.get('NEXT_PUBLIC_VAPID_PUBLIC_KEY') || ''
const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY') || ''
const expoAccessToken = Deno.env.get('EXPO_ACCESS_TOKEN') || ''
const pushTriggerSecret = Deno.env.get('PUSH_TRIGGER_SECRET') || ''

// Reads/writes run under the service role: subscription rows are RLS-locked
// to their owner, and only the service key may query another user's rows.
const db = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send'
// Keep in sync with the Android channel the app creates (pushService.ts).
const CHANNEL_ID = 'order-updates'

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
    status,
  })
}

// Human-friendly message from the order row.
function buildMessage(order: {
  status: string
  items: unknown
}): { title: string; body: string; url: string } {
  const statusLabel =
    order.status === 'paid'
      ? 'payment confirmed'
      : order.status === 'fulfilled'
        ? 'shipped / ready'
        : order.status === 'cancelled'
          ? 'was cancelled'
          : order.status
  let firstItem = ''
  const items = Array.isArray(order.items) ? order.items : []
  const row = items[0] as { name?: string } | undefined
  if (row?.name) {
    firstItem = items.length > 1 ? `${row.name} +${items.length - 1} more` : row.name
  }
  const title = firstItem ? `Order ${statusLabel}: ${firstItem}` : `Your order is ${statusLabel}`
  return { title, body: 'Tap to view your order.', url: '/account#orders' }
}

// ----- Transport 1: Web Push (browser subscriptions, VAPID — no Firebase) -----
async function pushWeb(userId: string, message: { title: string; body: string; url: string }) {
  if (!vapidPublicKey || !vapidPrivateKey) {
    return { sent: 0, skipped: 0, pruned: 0, reason: 'VAPID keys not configured' }
  }
  const { data: subs, error } = await db
    .from('web_push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', userId)
  if (error) throw new Error(`Web subscription lookup failed: ${error.message}`)

  let sent = 0
  const dead: string[] = []
  for (const sub of subs ?? []) {
    const result = await sendWebPush(sub.endpoint, sub.p256dh, sub.auth, vapidPublicKey, vapidPrivateKey, {
      title: message.title,
      body: message.body,
      url: message.url,
      tag: 'order-status',
    })
    if (result === 'sent') sent += 1
    else if (result === 'gone') dead.push(sub.id) // 404/410 — prune so we stop retrying
  }
  if (dead.length > 0) await db.from('web_push_subscriptions').delete().in('id', dead)
  return { sent, skipped: (subs ?? []).length - sent - dead.length, pruned: dead.length }
}

// ----- Transport 2: Expo push (native app; dormant until Firebase is on) -----
async function pushExpo(userId: string, order: { id: string; status: string }, message: { title: string; body: string }) {
  if (!expoAccessToken) {
    return { sent: 0, skipped: 0, pruned: 0, reason: 'EXPO_ACCESS_TOKEN not configured (Firebase dormant)' }
  }
  const { data: tokens, error } = await db
    .from('push_tokens')
    .select('id, token')
    .eq('user_id', userId)
  if (error) throw new Error(`Token lookup failed: ${error.message}`)

  let sent = 0
  const deadTokens: string[] = []
  for (const row of tokens ?? []) {
    const response = await fetch(EXPO_PUSH_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${expoAccessToken}`,
      },
      body: JSON.stringify({
        to: row.token,
        title: message.title,
        body: 'Tap to view the order in the GENUM app.',
        sound: 'default',
        channelId: CHANNEL_ID,
        priority: 'high',
        data: { orderId: order.id, status: order.status, type: 'order-status' },
      }),
    })
    const result = await response.json().catch(() => null)
    const ticket = Array.isArray(result?.data) ? result.data[0] : null
    if (response.ok && ticket?.status === 'ok') {
      sent += 1
    } else if (ticket?.details?.error === 'DeviceNotRegistered') {
      deadTokens.push(row.id) // remove stale tokens so we don't retry dead devices
    }
  }
  if (deadTokens.length > 0) {
    await db.from('push_tokens').delete().in('id', deadTokens)
  }
  return { sent, skipped: (tokens ?? []).length - sent - deadTokens.length, pruned: deadTokens.length }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS' },
    })
  }

  try {
    // Optional shared-secret gate so only the DB trigger can invoke this.
    if (pushTriggerSecret && req.headers.get('x-push-secret') !== pushTriggerSecret) {
      return json({ error: 'Forbidden' }, 403)
    }

    const body = await req.json().catch(() => ({}))
    const orderId = String(body.orderId || '')
    const newStatus = String(body.status || '')
    if (!orderId) return json({ error: 'orderId is required' }, 400)

    const { data: order, error: orderError } = await db
      .from('orders')
      .select('id, user_id, status, items')
      .eq('id', orderId)
      .maybeSingle()
    if (orderError) throw new Error(`Order lookup failed: ${orderError.message}`)
    if (!order?.user_id) {
      return json({ skipped: true, reason: 'no user on order' })
    }

    const message = buildMessage(order)
    const web = await pushWeb(order.user_id, message)
    const expo = await pushExpo(order.user_id, { id: order.id, status: newStatus }, message)

    return json({ web, expo })
  } catch (error) {
    console.error('push-order-status error:', error)
    return json({ error: error instanceof Error ? error.message : 'Internal error' }, 500)
  }
})
