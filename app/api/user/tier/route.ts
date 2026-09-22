import { NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'

// The signed-in user's tier (free/pro). Read through the session client so
// RLS applies; the tier column itself is admin-managed (protect_tier_column
// trigger), so this endpoint can never be used to self-promote.
export async function GET() {
  try {
    const supabase = createClient()
    const { data } = await supabase.auth.getUser()
    if (!data.user) return NextResponse.json({ tier: null })
    const { data: profile } = await supabase
      .from('profiles')
      .select('tier')
      .eq('id', data.user.id)
      .maybeSingle()
    return NextResponse.json({ tier: profile?.tier === 'pro' ? 'pro' : 'free' })
  } catch {
    return NextResponse.json({ tier: null })
  }
}
