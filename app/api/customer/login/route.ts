import { NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const email = String(body.email || '').trim()
  const password = String(body.password || '')
  if (!email || !password) return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 })
  const { error } = await createClient().auth.signInWithPassword({ email, password })
  if (error) return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 })
  return NextResponse.json({ ok: true })
}
