import { NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const name = String(body.name || '').trim()
  const email = String(body.email || '').trim().toLowerCase()
  const password = String(body.password || '')

  if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 6) {
    return NextResponse.json({ error: 'Enter a name, valid email, and password of at least 6 characters.' }, { status: 400 })
  }

  const supabase = createClient()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } },
  })

  if (error) {
    const message = /already registered|already exists/i.test(error.message)
      ? 'An account with that email already exists.'
      : 'Could not create the account. Try again.'
    return NextResponse.json({ error: message }, { status: /already/i.test(message) ? 409 : 500 })
  }
  // Email confirmation is disabled in this Supabase project, so a session is returned immediately.
  // If confirmation is ever enabled, tell the UI so it can show the "check your email" message.
  if (!data.session) return NextResponse.json({ ok: true, needsEmailConfirmation: true })
  return NextResponse.json({ ok: true })
}
