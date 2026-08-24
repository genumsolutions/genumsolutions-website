import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'

// Starts Google sign-in: bounces the visitor to Google, then back to /auth/callback.
export async function GET(request: NextRequest) {
  const origin = new URL(request.url).origin
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return NextResponse.redirect(`${origin}/login?error=config`)
  try {
    const { data, error } = await createClient().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${origin}/auth/callback?next=${encodeURIComponent('/account')}` },
    })
    if (error || !data.url) return NextResponse.redirect(`${origin}/login?error=google`)
    return NextResponse.redirect(data.url)
  } catch {
    return NextResponse.redirect(`${origin}/login?error=config`)
  }
}
