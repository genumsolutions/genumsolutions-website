import { NextResponse } from 'next/server'
import { createClient, getSessionUser } from '../../../../lib/supabase/server'

// Remove this browser's Web Push subscription (W-3). No endpoint in the body
// = remove ALL of the user's subscriptions (full opt-out).
export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Sign in to manage notifications.' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const endpoint = typeof body?.endpoint === 'string' && body.endpoint ? body.endpoint : null

  let query = createClient().from('web_push_subscriptions').delete().eq('user_id', user.id)
  if (endpoint) query = query.eq('endpoint', endpoint)
  const { error } = await query
  if (error) return NextResponse.json({ error: 'Could not update your notification settings.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
