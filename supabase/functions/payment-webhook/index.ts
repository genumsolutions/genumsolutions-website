import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const supabaseUrl = Deno.env.get('NEXT_PUBLIC_SUPABASE_URL')!
const supabaseAnonKey = Deno.env.get('NEXT_PUBLIC_SUPABASE_ANON_KEY')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(supabaseUrl, supabaseServiceKey!, {
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
    const body = await req.body
    const { provider, providerRef, amount, status, orderId } = body || {}

    if (!provider || !providerRef) {
      return new Response(JSON.stringify({ error: 'Missing provider or provider_ref' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // Append-only ledger write - never throws into caller's flow
    await supabase.from('transactions').insert({
      order_id: orderId || null,
      user_id: null,
      provider,
      provider_ref: String(providerRef),
      amount_npr: Math.max(0, Math.floor(amount || 0)),
      currency: 'NPR',
      status: status || 'initiated',
      raw_payload: body || {},
    })

    // If succeeded, also update order status
    if (status === 'succeeded' && orderId) {
      await supabase.from('orders').update({
        status: 'paid',
        provider_ref: String(providerRef),
        updated_at: new Date().toISOString(),
      }).eq('id', orderId)
    }

    return new Response(JSON.stringify({ recorded: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error('Payment webhook error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})