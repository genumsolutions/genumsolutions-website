import { NextResponse } from 'next/server'
import { recordPageView } from '../../../lib/analytics'
import { checkRateLimit, clientIp } from '../../../lib/rate-limit'

export async function POST(request: Request) {
  const limit = checkRateLimit(`track:${clientIp(request)}`, 30, 60_000)
  if (!limit.allowed) return NextResponse.json({ ok: true })

  const body = await request.json().catch(() => null)
  const path = typeof body?.path === 'string' ? body.path.slice(0, 500) : null
  if (!path) return NextResponse.json({ ok: true })

  const referrer = typeof body?.referrer === 'string' ? body.referrer.slice(0, 500) : null
  try {
    await recordPageView({ path, referrer })
  } catch (error) {
    console.error('Page view tracking failed', error)
  }
  return NextResponse.json({ ok: true })
}
