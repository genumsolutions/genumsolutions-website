import { NextResponse } from 'next/server'
import { recordPageView } from '../../../lib/analytics'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const path = typeof body?.path === 'string' ? body.path.slice(0, 500) : null
  if (!path) return NextResponse.json({ ok: true })

  const referrer = typeof body?.referrer === 'string' ? body.referrer.slice(0, 500) : null
  await recordPageView({ path, referrer })
  return NextResponse.json({ ok: true })
}
