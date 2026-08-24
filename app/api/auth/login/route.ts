import { NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'

export async function POST(request: Request) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return NextResponse.json({ error: 'Accounts are not configured.' }, { status: 503 })
  const body = await request.json().catch(() => ({}))
  const identifier = String(body.identifier || body.email || '').trim()
  const password = String(body.password || '')
  if (!identifier || !password) return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 })

  const supabase = createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email: identifier, password })
  if (error || !data.user) return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 })

  let role: 'admin' | 'customer' = 'customer'
  try {
    const { data: profile } = await createClient().from('profiles').select('role').eq('id', data.user.id).maybeSingle()
    if (profile?.role === 'admin') role = 'admin'
  } catch {
    // Default to customer role.
  }
  return NextResponse.json({ ok: true, role })
}
