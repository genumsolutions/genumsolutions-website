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
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    })
  }

  try {
    const body = await req.json()
    const action = body.action

    if (action === 'get') {
      const [{ data }] = await supabase.from('site_content').select('*').eq('id', 1).single()
      if (data) return new Response(JSON.stringify({ content: data }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      })
      // Return defaults if no row exists
      return new Response(JSON.stringify({ content: {
        id: 1,
        home_title: 'Technology you can touch, test, and trust.',
        home_body: 'Robotics kits, project solutions, fabrication, open tools, and training for curious builders, schools, and teams.',
        updated_at: new Date().toISOString(),
      } }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    if (action === 'upsert') {
      const { content } = body
      if (!content?.id) {
        return new Response(JSON.stringify({ error: 'Content needs id' }), {
          headers: { 'Content-Type': 'application/json' },
          status: 400,
        })
      }
      const payload = { ...content, updated_at: new Date().toISOString() }
      const { data, error } = await supabase.from('site_content').upsert(payload).select()
      if (error) throw error
      return new Response(JSON.stringify({ content: data[0] }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      headers: { 'Content-Type': 'application/json' },
      status: 404,
    })
  } catch (error) {
    console.error('Site content Edge Function error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})