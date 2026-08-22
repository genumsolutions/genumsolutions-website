import { NextResponse } from 'next/server'
import { adminCookie, createAdminToken, isAdminConfigured } from '../../../../lib/admin'

export async function POST(request: Request) {
  if (!isAdminConfigured()) return NextResponse.json({ error: 'Admin credentials are not configured.' }, { status: 503 })
  const body = await request.json().catch(() => ({}))
  if (body.username !== process.env.ADMIN_USERNAME || body.password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Invalid username or password.' }, { status: 401 })
  }
  const response = NextResponse.json({ ok: true })
  response.cookies.set(adminCookie(createAdminToken()))
  return response
}
