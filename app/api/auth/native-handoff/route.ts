import { NextResponse, type NextRequest } from 'next/server'
import { createClient, supabaseConfigured } from '../../../../lib/supabase/server'
import { checkRateLimit, clientIp } from '../../../../lib/rate-limit'

// Native sign-in handoff for the mobile app.
//
// The app cannot use Google OAuth inside its embedded WebView (Google blocks
// WebView callbacks), so it signs the user in natively instead:
//   - Google     -> PKCE OAuth in a system browser tab.
//   - Internal   -> email/password via @supabase/supabase-js.
//
// On success it POSTs the session tokens here. This endpoint validates the
// access token, then adopts the session with setSession - which writes the
// Supabase auth cookies for this origin. The WebView reloads and behaves as
// fully signed in, and the /api/auth/session probe serves the same profile.
export async function POST(request: NextRequest) {
  if (!supabaseConfigured()) {
    return NextResponse.json({ error: 'Accounts are not configured.' }, { status: 503 })
  }

  const { accessToken, refreshToken } = (await request.json().catch(() => ({}))) as {
    accessToken?: string
    refreshToken?: string
  }
  if (!accessToken || !refreshToken) {
    return NextResponse.json({ error: 'Missing session tokens.' }, { status: 400 })
  }

  const limit = checkRateLimit(`native-handoff:${clientIp(request)}`, 20, 60_000)
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Too many attempts. Please try again later.' }, { status: 429 })
  }

  try {
    const supabase = createClient()

    // The tokens must belong to a real user before we adopt them.
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(accessToken)
    if (userError || !user?.email) {
      return NextResponse.json({ error: 'Invalid access token.' }, { status: 401 })
    }

    // Adopt the session - writes the Supabase auth cookies for this origin.
    const { error: sessionError } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    })
    if (sessionError) {
      return NextResponse.json({ error: 'Could not establish your session.' }, { status: 401 })
    }

    let name = user.email.split('@')[0]
    let role: 'admin' | 'customer' = 'customer'
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('name, role')
        .eq('id', user.id)
        .maybeSingle()
      if (profile?.name) name = profile.name
      if (profile?.role === 'admin') role = 'admin'
    } catch {
      // Profile lookup is best-effort; defaults above are fine.
    }

    return NextResponse.json({ ok: true, user: { name, email: user.email, role } })
  } catch {
    return NextResponse.json({ error: 'Authentication is temporarily unavailable.' }, { status: 503 })
  }
}