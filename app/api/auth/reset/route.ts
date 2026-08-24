import { NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'

// Sends a password-recovery email. Always answers ok so the response
// never reveals whether an account exists for the given address.
export async function POST(request: Request) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return NextResponse.json({ error: 'Accounts are not configured.' }, { status: 503 })
  const body = await request.json().catch(() => ({}))
  const email = String(body.email || '').trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 })

  try {
    // Return to the host the visitor is actually on, so localhost tests round-trip locally.
    const origin = new URL(request.url).origin
    await createClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent('/reset-password')}`,
    })
  } catch {
    // Swallow provider errors - the generic message below covers them.
  }
  return NextResponse.json({ ok: true })
}
