import { NextResponse } from 'next/server'
import { createClient, supabaseConfigured } from '../../../../lib/supabase/server'
import { checkRateLimit, clientIp } from '../../../../lib/rate-limit'

// Canonical email + password sign-in. Returns the caller's role so the UI
// can route admins to /admin and customers to /account.
export async function POST(request: Request) {
  if (!supabaseConfigured()) return NextResponse.json({ error: 'Accounts are not configured.' }, { status: 503 })

  const body = await request.json().catch(() => ({}))
  const email = String(body.email || '').trim().toLowerCase()
  const password = String(body.password || '')
  if (!email || !password) return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 })

  // Throttle per IP and per account to slow credential stuffing.
  for (const key of [`login-ip:${clientIp(request)}`, `login-acct:${email}`]) {
    const limit = checkRateLimit(key, 10, 60_000)
    if (!limit.allowed) {
      return NextResponse.json({ error: 'Too many sign-in attempts. Please wait a minute and try again.' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } })
    }
  }

  try {
    const supabase = createClient()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error || !data.user) return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 })

    let role: 'admin' | 'customer' = 'customer'
    try {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).maybeSingle()
      if (profile?.role === 'admin') role = 'admin'
    } catch {
      // Profile lookup is best-effort; default to customer.
    }
    return NextResponse.json({ ok: true, role })
  } catch {
    return NextResponse.json({ error: 'Accounts are temporarily unavailable. Try again.' }, { status: 503 })
  }
}
