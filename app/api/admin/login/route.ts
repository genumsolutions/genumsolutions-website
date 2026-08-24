import { NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const email = String(body.email || body.username || '').trim()
  const password = String(body.password || '')
  if (!email || !password) return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 })

  const supabase = createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error || !data.user) return NextResponse.json({ error: 'Invalid username or password.' }, { status: 401 })

  const { data: profile } = await createClient().from('profiles').select('role').eq('id', data.user.id).maybeSingle()
  if (profile?.role !== 'admin') {
    await supabase.auth.signOut()
    return NextResponse.json({ error: 'This account does not have admin access.' }, { status: 403 })
  }
  return NextResponse.json({ ok: true })
}
