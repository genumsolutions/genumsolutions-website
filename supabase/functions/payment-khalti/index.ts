import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const supabaseUrl = Deno.env.get('NEXT_PUBLIC_SUPABASE_URL')!
const supabaseAnonKey = Deno.env.get('NEXT_PUBLIC_SUPABASE_ANON_KEY')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const khaltiSecretKey = Deno.env.get('KHALTI_SECRET_KEY')!
const khaltiBaseUrl = Deno.env.get('KHALTI_BASE_URL') || 'https://a.khalti.com/api/v2'

// Order updates + transactions require service privileges (admin RLS /
// append-only ledger); reads fall back to the anon client so web keeps working.
const serviceClient = supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
    status,
  })
}

function html(body: string, status = 200) {
  return new Response(body, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
    status,
  })
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }
}

async function findOrder(orderId: string) {
  const { data } = await supabase.from('orders').select('id, total_npr, user_id, status, provider').eq('id', orderId).maybeSingle()
  return data as { id: string; total_npr: number; user_id: string | null; status: string; provider: string } | null
}

async function markPaidAndLog(order: { id: string; total_npr: number; user_id: string | null }, providerRef: string, rawPayload: unknown) {
  const db = serviceClient ?? supabase
  await db.from('orders').update({
    status: 'paid',
    provider_ref: providerRef,
    updated_at: new Date().toISOString(),
  }).eq('id', order.id)
  await db.from('transactions').update({
    status: 'succeeded',
    raw_payload: rawPayload ?? {},
  }).eq('provider_ref', providerRef)
  // Best-effort cart clear so the buyer's build list empties after payment.
  await db.from('carts').upsert({
    user_id: order.user_id,
    lines: [],
    updated_at: new Date().toISOString(),
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders() })
  }

  const url = new URL(req.url)
  const action = url.searchParams.get('action') || (await req.json().catch(() => ({}))).action

  try {
    if (action === 'initiate') {
      const body = await req.json().catch(() => ({}))
      const { amount, purchaseOrderId, purchaseOrderName, customerInfo } = body
      if (!khaltiSecretKey) {
        return json({ error: 'Khalti not configured' }, 503)
      }

      // Return to the edge function itself, which verifies then redirects the
      // browser back into the native app via its custom scheme.
      const fnOrigin = `${url.protocol}//${url.host}${url.pathname.replace(/\/$/u, '')}`
      const returnUrl = `${fnOrigin}?action=return&order=${encodeURIComponent(String(purchaseOrderId))}`
      // Khalti requires a website_url; any valid https site on this Supabase
      // project satisfies the API for a mobile-first flow.
      const websiteUrl = `${url.protocol}//${url.host}`

      const response = await fetch(`${khaltiBaseUrl}/epayment/initiate/`, {
        method: 'POST',
        headers: {
          Authorization: `Key ${khaltiSecretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          return_url: returnUrl,
          website_url: websiteUrl,
          amount: amount * 100,
          purchase_order_id: String(purchaseOrderId),
          purchase_order_name: purchaseOrderName || 'GENUM order',
          customer_info: customerInfo || {},
        }),
      })

      const result = await response.json()

      if (!response.ok || !result?.payment_url) {
        return json({ error: result?.error || 'Khalti initiate failed' }, 502)
      }

      const db = serviceClient ?? supabase
      await db.from('transactions').insert({
        order_id: String(purchaseOrderId),
        provider_ref: result.pidx || '',
        provider: 'khalti',
        amount_npr: Math.floor(amount),
        currency: 'NPR',
        status: 'initiated',
        raw_payload: { pidx: result.pidx, ...result },
      })

      return json({ url: result.payment_url, pidx: result.pidx, orderId: String(purchaseOrderId) })
    }

    if (action === 'return') {
      const orderId = url.searchParams.get('order') || ''
      const pidx = url.searchParams.get('pidx') || ''
      if (!orderId || !pidx) {
        return html(`<!doctype html><html><body><script>location.replace('genumsolutions://checkout?provider=khalti&status=no-order')</script></body></html>`)
      }
      const order = await findOrder(orderId)
      if (!order || order.provider !== 'khalti') {
        return html(`<!doctype html><html><body><script>location.replace('genumsolutions://checkout?provider=khalti&status=no-order')</script></body></html>`)
      }
      if (order.status === 'paid') {
        return html(`<!doctype html><html><body><script>location.replace('genumsolutions://checkout/success?provider=khalti&order=${orderId}&paid=1')</script></body></html>`)
      }

      if (!khaltiSecretKey) {
        return html(`<!doctype html><html><body><script>location.replace('genumsolutions://checkout?provider=khalti&status=verify-pending')</script></body></html>`)
      }
      const verifyResponse = await fetch(`${khaltiBaseUrl}/epayment/lookup/`, {
        method: 'POST',
        headers: {
          Authorization: `Key ${khaltiSecretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ pidx }),
      })
      const verifyResult = await verifyResponse.json().catch(() => null)
      const paid = verifyResult?.status === 'success' && verifyResult?.payment_status === 'COMPLETED'

      if (!paid) {
        return html(`<!doctype html><html><body><script>location.replace('genumsolutions://checkout?provider=khalti&order=${orderId}&status=not-paid')</script></body></html>`)
      }
      await markPaidAndLog(order, pidx, {...verifyResult, verifiedServerSide: true })
      return html(`<!doctype html><html><body><script>location.replace('genumsolutions://checkout/success?provider=khalti&order=${orderId}&paid=1')</script></body></html>`)
    }

    // Kept for any web/legacy caller: verify a pidx for an order.
    if (action === 'verify') {
      const body = await req.json().catch(() => ({}))
      const { pidx, orderId } = body
      if (!khaltiSecretKey) {
        return json({ valid: false })
      }
      if (!pidx) {
        return json({ valid: false, error: 'pidx required' }, 400)
      }
      const verifyResponse = await fetch(`${khaltiBaseUrl}/epayment/lookup/`, {
        method: 'POST',
        headers: {
          Authorization: `Key ${khaltiSecretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ pidx }),
      })
      const verifyResult = await verifyResponse.json().catch(() => null)
      const paid = verifyResult?.status === 'success' && verifyResult?.payment_status === 'COMPLETED'
      if (paid && orderId) {
        const order = await findOrder(String(orderId))
        if (order) await markPaidAndLog(order, pidx, { ...verifyResult, verifiedServerSide: true })
      }
      return json({ valid: Boolean(verifyResult?.status === 'success'), paid })
    }

    return json({ error: 'Unknown action' }, 400)
  } catch (error) {
    console.error('Khalti Edge Function error:', error)
    return json({ error: error.message ?? 'Internal error' }, 500)
  }
})