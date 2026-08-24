import { NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'

// Sets a new password for the signed-in user (reached after the recovery link).
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const password = String(body.password || '')
  if (password.length < 6) return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 })

  try {
    const { error } = await createClient().auth.updateUser({ password })
    if (error) return NextResponse.json({ error: 'Could not update the password. Open the email link again and retry.' }, { status: 401 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Accounts are not configured.' }, { status: 503 })
  }
}
