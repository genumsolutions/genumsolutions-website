import { NextResponse } from 'next/server'
import { createClient, supabaseConfigured } from '../../../../lib/supabase/server'

// Creates a customer account with email + password (works for Gmail or any address).
export async function POST(request: Request) {
  if (!supabaseConfigured()) return NextResponse.json({ error: 'Accounts are not configured.' }, { status: 503 })

  const body = await request.json().catch(() => ({}))
  const name = String(body.name || '').trim()
  const email = String(body.email || '').trim().toLowerCase()
  const password = String(body.password || '')

  if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 6) {
    return NextResponse.json({ error: 'Enter a name, valid email, and password of at least 6 characters.' }, { status: 400 })
  }

  try {
    const { data, error } = await createClient().auth.signUp({
      email,
      password,
      options: { data: { name } },
    })

    if (error) {
      const exists = /already registered|already exists/i.test(error.message)
      return NextResponse.json(
        { error: exists ? 'An account with that email already exists.' : 'Could not create the account. Try again.' },
        { status: exists ? 409 : 500 },
      )
    }
    // Email confirmation is disabled in this Supabase project, so a session is returned
    // immediately. If confirmation is ever enabled, tell the UI to show the notice.
    if (!data.session) return NextResponse.json({ ok: true, needsEmailConfirmation: true })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Accounts are temporarily unavailable. Try again.' }, { status: 503 })
  }
}
