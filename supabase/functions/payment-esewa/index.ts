import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const supabaseUrl = Deno.env.get('NEXT_PUBLIC_SUPABASE_URL')!
const supabaseAnonKey = Deno.env.get('NEXT_PUBLIC_SUPABASE_ANON_KEY')!
const esewaSecretKey = Deno.env.get('ESEWA_SECRET_KEY')!

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

interface EsewaVerify {
  total_amount: string
  transaction_uuid: string
  signed_field_names: string
  signature: string
  product_code: string
}

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
      const { amount, transactionUuid, productCode, successUrl, failureUrl } = body
      if (!esewaSecretKey) {
        return new Response(
          JSON.stringify({ error: 'eSewa not configured' }),
          { headers: { 'Content-Type': 'application/json' }, status: 503 }
        )
      }

      const fields: Record<string, string> = {
        amount,
        tax_amount: '0',
        total_amount: amount,
        transaction_uuid: transactionUuid,
        product_code: productCode || 'EPAYTEST',
        success_url: successUrl || '',
        failure_url: failureUrl || '',
        signed_field_names: 'total_amount,transaction_uuid,product_code',
      }

      // Build signature
      const signedNames = fields.signed_field_names
      if (!signedNames) {
        return new Response(JSON.stringify({ error: 'signed_field_names required' }), {
          headers: { 'Content-Type': 'application/json' },
          status: 400,
        })
      }
      const names = signedNames.split(',')
      const message = names.map((name) => `${name}=${fields[name] ?? ''}`).join(',')
      const signature = Deno.run({
        cmd: ['bash', '-c', `echo -n "${message}" | openssl dgst -sha256 -hmac "${esewaSecretKey}" | awk '{print $NF}'`],
      }).outputSync()
      const sig = new TextDecoder().decode(signature).trim()

      fields.signature = sig

      // Return action URL + fields for frontend to redirect
      const baseUrl = process.env.ESEWA_BASE_URL || 'https://uat.esewa.com.np'
      const actionUrl = `${baseUrl}/epay/main`

      return new Response(
        JSON.stringify({ action: actionUrl, fields }),
        {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    if (action === 'verify') {
      const { signature, fields } = body
      if (!esewaSecretKey) {
        return new Response(JSON.stringify({ valid: false }), {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        })
      }
      const signedNames = fields?.signed_field_names
      if (!signedNames) return new Response(JSON.stringify({ valid: false }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      })
      const names = signedNames.split(',')
      const message = names.map((name) => `${name}=${fields[name] ?? ''}`).join(',')
      const expected = Deno.run({
        cmd: ['bash', -c`, `echo -n "${message}" | openssl dgst -sha256 -hmac "${esewaSecretKey}" | awk '{print $NF}'`],
      }).outputSync()
      const valid = new TextDecoder().decode(expected).trim() === signature

      // If valid, log transaction and update order status
      if (valid && fields.transaction_uuid) {
        await supabase.from('transactions').insert({
          order_id: fields.transaction_uuid,
          provider_ref: fields.transaction_uuid,
          provider: 'esewa',
          amount_npr: Number(fields.amount),
          status: 'succeeded',
          raw_payload: fields,
        })
        await supabase.from('orders').update({
          status: 'paid',
          provider_ref: fields.transaction_uuid,
          updated_at: new Date().toISOString(),
        }).eq('id', fields.transaction_uuid)
      }

      return new Response(JSON.stringify({ valid }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      headers: { 'Content-Type': 'application/json' },
      status: 400,
    })
  } catch (error) {
    console.error('eSewa Edge Function error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})