import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const supabaseUrl = Deno.env.get('NEXT_PUBLIC_SUPABASE_URL')!
const supabaseAnonKey = Deno.env.get('NEXT_PUBLIC_SUPABASE_ANON_KEY')!
const khaltiSecretKey = Deno.env.get('KHALTI_SECRET_KEY')!

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

serve(async (req) => {
  const url = new URL(req.url)

  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    })
  }

  try {
    const body = await req.json()
    const action = body.action

    if (action === 'initiate') {
      const { amount, purchaseOrderId, purchaseOrderName, returnUrl, websiteUrl, customerInfo } = body
      if (!khaltiSecretKey) {
        return new Response(
          JSON.stringify({ error: 'Khalti not configured' }),
          { headers: { 'Content-Type': 'application/json' }, status: 503 }
        )
      }

      const baseUrl = process.env.KHALTI_BASE_URL || 'https://a.khalti.com/api/v2'

      const response = await fetch(`${baseUrl}/epayment/initiate/`, {
        method: 'POST',
        headers: {
          Authorization: `Key ${khaltiSecretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          return_url: returnUrl || '',
          website_url: websiteUrl || undefined,
          amount: amount * 100, // paisa
          purchase_order_id: purchaseOrderId,
          purchase_order_name: purchaseOrderName || 'GENUM order',
          customer_info: customerInfo || {},
        }),
      })

      const result = await response.json()

      if (!response.ok || !result?.payment_url) {
        return new Response(
          JSON.stringify({ error: result?.error || 'Khalti initiate failed' }),
          { headers: { 'Content-Type': 'application/json' }, status: 502 }
        )
      }

      // Log transaction
      await supabase.from('transactions').insert({
        order_id: purchaseOrderId,
        provider_ref: result.pidx || '',
        provider: 'khalti',
        amount_npr: Math.floor(amount),
        currency: 'NPR',
        status: 'initiated',
        raw_payload: { pidx: result.pidx, ...result },
      })

      return new Response(
        JSON.stringify({ url: result.payment_url, pidx: result.pidx, orderId: purchaseOrderId }),
        {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    if (action === 'verify') {
      const { pidx, status } = body
      if (!khaltiSecretKey) {
        return new Response(JSON.stringify({ valid: false }), {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        })
      }

      const baseUrl = process.env.KHALTI_BASE_URL || 'https://a.khalti.com/api/v2'
      const verifyResponse = await fetch(`${baseUrl}/epayment/lookup/`, {
        method: 'POST',
        headers: {
          Authorization: `Key ${khaltiSecretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ pidx }),
      })

      const verifyResult = await verifyResponse.json()

      if (verifyResult?.status === 'success' && verifyResult?.payment_status === 'completed') {
        // Update order and transaction
        await supabase.from('orders').update({
          status: 'paid',
          provider_ref: pidx,
          updated_at: new Date().toISOString(),
        }).eq('id', pidx)

        await supabase.from('transactions').update({
          status: 'succeeded',
          raw_payload: verifyResult,
        }).eq('provider_ref', pidx)
      }

      return new Response(JSON.stringify({ valid: verifyResult?.status === 'success' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      headers: { 'Content-Type': 'application/json' },
      status: 400,
    })
  } catch (error) {
    console.error('Khalti Edge Function error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})