import { NextResponse } from 'next/server'
import { getSessionUser } from '../../../../lib/supabase/server'
import { getProfile, updateProfile } from '../../../../lib/customer-store'

export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const profile = await getProfile(user.id)
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({ profile: { name: profile.name, phone: profile.phone, address: profile.address } })
}

export async function PATCH(request: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Sign in to update your profile.' }, { status: 401 })
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  const updated = await updateProfile(user.id, {
    name: typeof body.name === 'string' ? body.name : undefined,
    phone: typeof body.phone === 'string' ? body.phone : undefined,
    address: typeof body.address === 'string' ? body.address : undefined,
  })
  if (!updated) return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 })
  return NextResponse.json({ ok: true, profile: { name: updated.name, phone: updated.phone, address: updated.address } })
}
