// =====================================================================
// push-order-status — sends an Expo push notification to the order's
// buyer when an order status changes (pending -> paid -> fulfilled / cancelled).
//
// Invoked by the database trigger in order-status-push-trigger.sql via
// pg_net with a JSON body: { "orderId": "...", "status": "paid" }.
//
// Deployment (Supabase dashboard or CLI):
//   1. supabase/functions deploy push-order-status
//   2. Set function secrets:
//        EXPO_ACCESS_TOKEN      Expo account access token (expo.dev ->
//                               Account Settings -> Access tokens). REQUIRED.
//        PUSH_TRIGGER_SECRET    Optional shared secret. When set, the DB
//                               trigger must send it as the x-push-secret
//                               header (see order-status-push-trigger.sql).
//   3. Run supabase/schema.sql (push_tokens table) in the SQL editor.
//   4. Run supabase/order-status-push-trigger.sql after enabling pg_net.
//
// Android delivery additionally requires Firebase Cloud Messaging wired
// into the APK build (google-services.json + app.json
// android.googleServicesFile) — see mobile/src/config/push.ts. Without it,
// Expo cannot reach the device.
// =====================================================================
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const supabaseUrl = Deno.env.get('NEXT_PUBLIC_SUPABASE_URL') || ''
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const expoAccessToken = Deno.env.get('EXPO_ACCESS_TOKEN') || ''
const pushTriggerSecret = Deno.env.get('PUSH_TRIGGER_SECRET') || ''

// Reads/writes run under the service role: push_tokens rows are RLS-locked
// to their owner, and only the service key may query another user's tokens.
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
}): { title: string; body: string } {
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
  return {
    title: firstItem ? `Order ${statusLabel}: ${firstItem}` : `Your order is ${statusLabel}`,
    body: 'Tap to view the order in the GENUM app.',
  }
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

    if (!expoAccessToken) {
      return json(
        { error: 'EXPO_ACCESS_TOKEN is not configured on this function — push is inactive.' },
        503,
      )
    }

    const { data: order, error: orderError } = await db
      .from('orders')
      .select('id, user_id, status, items')
      .eq('id', orderId)
      .maybeSingle()
    if (orderError) throw new Error(`Order lookup failed: ${orderError.message}`)
    if (!order?.user_id) {
      return json({ skipped: true, reason: 'no user on order' })
    }

    const { data: tokens, error: tokenError } = await db
      .from('push_tokens')
      .select('id, token')
      .eq('user_id', order.user_id)
    if (tokenError) throw new Error(`Token lookup failed: ${tokenError.message}`)

    const { title, body: messageBody } = buildMessage(order)
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
          title,
          body: messageBody,
          sound: 'default',
          channelId: CHANNEL_ID,
          priority: 'high',
          data: { orderId: order.id, status: newStatus, type: 'order-status' },
        }),
      })
      const result = await response.json().catch(() => null)
      const ticket = Array.isArray(result?.data) ? result.data[0] : null
      if (response.ok && ticket?.status === 'ok') {
        sent += 1
      } else if (ticket?.details?.error === 'DeviceNotRegistered') {
        // Remove stale tokens so we don't retry dead devices forever.
        deadTokens.push(row.id)
      }
    }

    if (deadTokens.length > 0) {
      await db.from('push_tokens').delete().in('id', deadTokens)
    }

    return json({ sent, skipped: (tokens ?? []).length - sent, cleaned: deadTokens.length })
  } catch (error) {
    console.error('push-order-status error:', error)
    return json({ error: error instanceof Error ? error.message : 'Internal error' }, 500)
  }
})
