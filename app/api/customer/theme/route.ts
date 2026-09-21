import { NextResponse } from 'next/server'
import { getSessionUser } from '../../../../lib/supabase/server'
import { getThemePreference, updateThemePreference } from '../../../../lib/customer-store'

function parse(value: unknown): 'system' | 'light' | 'dim' | null {
  return value === 'system' || value === 'light' || value === 'dim' ? value : null
}

// The signed-in user's saved theme preference (W-6 — one choice across app + web).
export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ theme: 'system' })
  const theme = await getThemePreference(user.id)
  return NextResponse.json({ theme })
}

export async function PUT(request: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Sign in to save your theme preference.' }, { status: 401 })
  const body = await request.json().catch(() => null)
  const theme = parse(body?.theme)
  if (!theme) return NextResponse.json({ error: 'theme must be system, light, or dim.' }, { status: 400 })
  const saved = await updateThemePreference(user.id, theme)
  if (!saved) return NextResponse.json({ error: 'Could not save your theme preference.' }, { status: 500 })
  return NextResponse.json({ ok: true, theme: saved })
}
