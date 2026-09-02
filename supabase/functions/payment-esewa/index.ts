import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const supabaseUrl = Deno.env.get('NEXT_PUBLIC_SUPABASE_URL')!
const supabaseAnonKey = Deno.env.get('NEXT_PUBLIC_SUPABASE_ANON_KEY')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const esewaSecretKey = Deno.env.get('ESEWA_SECRET_KEY')!
const esewaBaseUrl = Deno.env.get('ESEWA_BASE_URL') || 'https://uat.esewa.com.np'
const esewaProductCode = Deno.env.get('ESEWA_PRODUCT_CODE') || 'EPAYTEST'

// Writes (order paid + transaction ledger) run under the service role because
// the transactions table is append-only and orders require admin RLS. Reads
// fall back to the anon client so the app / web always work.
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

// base64(HMAC-SHA256(secret, signed fields joined as k=v,...))
function signFields(fields: Record<string, string>, secret: string) {
  const signedNames = fields.signed_field_names
  if (!signedNames) throw new Error('signed_field_names is required')
  const names = signedNames.split(',')
  const message = names.map((name) => `${name}=${fields[name] ?? ''}`).join(',')
  const sig = new TextDecoder().decode(
    Deno.run({
      cmd: ['bash', '-c', `echo -n "${message}" | openssl dgst -sha256 -hmac "${secret}" -binary | base64`],
    }).outputSync(),
  ).trim()
  return sig
}

interface EsewaCallback {
  product_code?: string
  transaction_uuid?: string
  total_amount?: string | number
  transaction_code?: string
  status?: string
}

async function findOrder(orderId: string) {
  const { data } = await supabase.from('orders').select('id, total_npr, user_id, status, provider').eq('id', orderId).maybeSingle()
  return data as { id: string; total_npr: number; user_id: string | null; status: string; provider: string } | null
}

// Server-to-server eSewa status check, mirroring the website confirm route.
async function esewaStatusComplete(orderId: string, amountNpr: number): Promise<boolean> {
  const auth = btoa(`${esewaProductCode}:${esewaSecretKey}`)
  const params = new URLSearchParams({
    product_code: esewaProductCode,
    total_amount: String(amountNpr),
    transaction_uuid: orderId,
  })
  const response = await fetch(`${esewaBaseUrl}/api/epay/status?${params}`, {
    headers: { Authorization: `Basic ${auth}` },
  })
  const result = await response.json().catch(() => null)
  return response.ok && result?.status === 'COMPLETE'
}

async function markPaidAndLog(order: { id: string; total_npr: number; user_id: string | null }, providerRef: string, rawPayload: unknown) {
  const db = serviceClient ?? supabase
  await db.from('orders').update({
    status: 'paid',
    provider_ref: providerRef,
    updated_at: new Date().toISOString(),
  }).eq('id', order.id)
  await db.from('transactions').insert({
    order_id: order.id,
    user_id: order.user_id,
    provider: 'esewa',
    provider_ref: String(providerRef || ''),
    amount_npr: Math.max(0, Math.floor(order.total_npr)),
    currency: 'NPR',
    status: 'succeeded',
    raw_payload: rawPayload ?? {},
  })
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
      const amount = String(body.amount ?? '')
      const transactionUuid = String(body.transactionUuid ?? '')
      const productCode = String(body.productCode || esewaProductCode)
      if (!esewaSecretKey) {
        return json({ error: 'eSewa not configured' }, 503)
      }

      const fnOrigin = `${url.protocol}//${url.host}${url.pathname.replace(/\/$/u, '')}`
      const successUrl = `${fnOrigin}?action=return&order=${encodeURIComponent(transactionUuid)}`
      const failureUrl = `${fnOrigin}?action=cancel&order=${encodeURIComponent(transactionUuid)}`

      const fields: Record<string, string> = {
        amount,
        tax_amount: '0',
        total_amount: amount,
        transaction_uuid: transactionUuid,
        product_code: productCode,
        success_url: successUrl,
        failure_url: failureUrl,
        signed_field_names: 'total_amount,transaction_uuid,product_code',
      }
      fields.signature = signFields(fields, esewaSecretKey)

      const query = new URLSearchParams(fields)
      const renderUrl = `${fnOrigin}?action=form&${query.toString()}`

      return json({ renderUrl, orderId: transactionUuid })
    }

    // Renders a tiny auto-submitting HTML form page so a fully native app can
    // hand off to eSewa's epay/main without a WebView. No website involved.
    if (action === 'form') {
      const keys = ['amount', 'tax_amount', 'total_amount', 'transaction_uuid', 'product_code', 'success_url', 'failure_url', 'signed_field_names', 'signature']
      const inputs = keys
        .map((k) => {
          const v = url.searchParams.get(k) ?? ''
          return `<input type="hidden" name="${k}" value="${v.replace(/"/gu, '&quot;')}" />`
        })
        .join('\n    ')
      const actionUrl = `${esewaBaseUrl}/epay/main`
      return html(`<!doctype html>
<html lang="en">
<head><meta charset="utf-8" /><title>GENUM · eSewa</title>
<style>body{font-family:system-ui,Segoe UI,Roboto,sans-serif;background:#0f172a;color:#e2e8f0;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}main{text-align:center}p{opacity:.8}</style>
</head>
<body onload="document.getElementById('esewa-form').submit()">
<main><h2>Redirecting to eSewa…</h2><p>If nothing happens, tap the button below.</p>
<form id="esewa-form" method="POST" action="${actionUrl}">
    ${inputs}
    <noscript><button type="submit">Continue to eSewa</button></noscript>
</form></main>
</body>
</html>`)
    }

    // eSewa bounces the user to success_url with ?data=<base64 JSON>. We decode
    // it, verify server-to-server, mark paid, then redirect the browser back to
    // the native app via its custom scheme.
    if (action === 'return') {
      const orderId = url.searchParams.get('order') || ''
      const raw = url.searchParams.get('data') || ''
      let payload: EsewaCallback = {}
      if (raw) {
        try {
          const bytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0))
          payload = JSON.parse(new TextDecoder().decode(bytes))
        } catch {
          payload = {}
        }
      }
      const txnUuid = String(payload.transaction_uuid || orderId || '')
      const order = await findOrder(txnUuid)
      if (!order || order.provider !== 'esewa') {
        return html(`<!doctype html><html><body><script>location.replace('genumsolutions://checkout?provider=esewa&status=no-order')</script></body></html>`)
      }
      if (order.status === 'paid') {
        return html(`<!doctype html><html><body><script>location.replace('genumsolutions://checkout/success?provider=esewa&order=${txnUuid}&paid=1')</script></body></html>`)
      }
      if (Number(payload.total_amount) !== order.total_npr) {
        return html(`<!doctype html><html><body><script>location.replace('genumsolutions://checkout?provider=esewa&status=amount-mismatch')</script></body></html>`)
      }
      const complete = await esewaStatusComplete(txnUuid, order.total_npr)
      if (!complete) {
        return html(`<!doctype html><html><body><script>location.replace('genumsolutions://checkout?provider=esewa&status=not-paid')</script></body></html>`)
      }
      await markPaidAndLog(order, String(payload.transaction_code || txnUuid), { ...payload, verifiedServerSide: true })
      return html(`<!doctype html><html><body><script>location.replace('genumsolutions://checkout/success?provider=esewa&order=${txnUuid}&paid=1')</script></body></html>`)
    }

    if (action === 'cancel') {
      const orderId = url.searchParams.get('order') || ''
      return html(`<!doctype html><html><body><script>location.replace('genumsolutions://checkout?provider=esewa&order=${orderId}&status=cancelled')</script></body></html>`)
    }

    return json({ error: 'Unknown action' }, 400)
  } catch (error) {
    console.error('eSewa Edge Function error:', error)
    return json({ error: error.message ?? 'Internal error' }, 500)
  }
})