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
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    })
  }

  try {
    const body = await req.json()
    const action = body.action

    if (action === 'list') {
      const { data, error } = await supabase.from('services').select('*').order('sort_order', { ascending: true })
      if (error) throw error
      return new Response(JSON.stringify({ services: data }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    if (action === 'create') {
      const { service } = body
      if (!service?.id || !service?.name) {
        return new Response(JSON.stringify({ error: 'Service needs id and name' }), {
          headers: { 'Content-Type': 'application/json' },
          status: 400,
        })
      }
      const payload = { ...service, updated_at: new Date().toISOString() }
      const { data, error } = await supabase.from('services').upsert(payload).select()
      if (error) throw error
      return new Response(JSON.stringify({ service: data[0] }), {
        headers: { 'Content-Type': 'application/json' },
        status: 201,
      })
    }

    if (action === 'update') {
      const { id, service } = body
      if (!id || !service) {
        return new Response(JSON.stringify({ error: 'Missing id or service' }), {
          headers: { 'Content-Type': 'application/json' },
          status: 400,
        })
      }
      const payload = { ...service, id: id.trim().toLowerCase().replace(/\s+/g, '-'), updated_at: new Date().toISOString() }
      const { data, error } = await supabase.from('services').upsert(payload).select()
      if (error) throw error
      return new Response(JSON.stringify({ service: data[0] }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    if (action === 'delete') {
      const { id } = body
      if (!id) {
        return new Response(JSON.stringify({ error: 'Missing id' }), {
          headers: { 'Content-Type': 'application/json' },
          status: 400,
        })
      }
      const { error } = await supabase.from('services').delete().eq('id', id)
      if (error) throw error
      return new Response(JSON.stringify({ deleted: true }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    if (action === 'toggle') {
      const { id } = body
      if (!id) {
        return new Response(JSON.stringify({ error: 'Missing id' }), {
          headers: { 'Content-Type': 'application/json' },
          status: 400,
        })
      }
      const { data, error } = await supabase.from('services').update({ active: !body.currentStatus }).eq('id', id).select()
      if (error) throw error
      return new Response(JSON.stringify({ service: data[0], active: data[0].active }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      headers: { 'Content-Type': 'application/json' },
      status: 404,
    })
  } catch (error) {
    console.error('Admin services Edge Function error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})