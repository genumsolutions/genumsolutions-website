import { NextResponse } from 'next/server'
import { isAdminRequest } from '../../../../lib/admin'
import { getSiteContent, saveSiteContent } from '../../../../lib/content-store'

export async function GET() {
  if (!(await isAdminRequest())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json(await getSiteContent())
}

export async function PUT(request: Request) {
  if (!(await isAdminRequest())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => null)
  if (!body?.homeTitle || !body?.homeBody) return NextResponse.json({ error: 'Homepage title and body are required.' }, { status: 400 })
  await saveSiteContent({ homeTitle: String(body.homeTitle), homeBody: String(body.homeBody) })
  return NextResponse.json({ ok: true })
}
