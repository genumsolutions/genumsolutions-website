import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '../../../lib/supabase/server'

// Supabase redirects here after Google OAuth sign-in and password-recovery emails.
// Handles the PKCE ?code= flow and the legacy token_hash email-link format.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type')

  // Only allow relative next paths to avoid open redirects.
  const rawNext = searchParams.get('next') || '/reset-password'
  const next = /^\/[^/\\]/.test(rawNext) ? rawNext : '/reset-password'

  try {
    const supabase = createClient()
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (!error) return NextResponse.redirect(`${origin}${next}`)
    } else if (tokenHash && (type === 'recovery' || type === 'signup' || type === 'invite' || type === 'magiclink')) {
      const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
      if (!error) return NextResponse.redirect(`${origin}${next}`)
    }
  } catch {
    // Unconfigured Supabase or network hiccup - fall through to the failure redirect.
  }
  return NextResponse.redirect(`${origin}/login?error=link`)
}
