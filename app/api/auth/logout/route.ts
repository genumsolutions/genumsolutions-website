import { NextResponse } from 'next/server'
import { createClient, supabaseConfigured } from '../../../../lib/supabase/server'

// Signs the current session out. Callers navigate themselves afterwards.
export async function POST() {
  if (!supabaseConfigured()) return NextResponse.json({ ok: true })
  try {
    await createClient().auth.signOut()
  } catch {
    // Clearing cookies client-side is enough when Supabase is unreachable.
  }
  return NextResponse.json({ ok: true })
}
