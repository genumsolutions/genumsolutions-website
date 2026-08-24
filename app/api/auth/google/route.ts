import { NextResponse, type NextRequest } from 'next/server'
import { createClient, supabaseConfigured } from '../../../../lib/supabase/server'

// Starts Google sign-in/up: bounces the visitor to Google, then back to /auth/callback.
// Optional ?next=/path controls where the callback sends them afterwards.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  if (!supabaseConfigured()) return NextResponse.redirect(`${origin}/login?error=config`)

  const rawNext = searchParams.get('next') || '/account'
  const next = /^\/[^/\\]/.test(rawNext) ? rawNext : '/account'

  try {
    const { data, error } = await createClient().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}` },
    })
    if (error || !data.url) return NextResponse.redirect(`${origin}/login?error=google`)
    return NextResponse.redirect(data.url)
  } catch {
    return NextResponse.redirect(`${origin}/login?error=config`)
  }
}
