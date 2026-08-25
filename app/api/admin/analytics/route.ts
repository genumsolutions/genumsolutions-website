import { NextResponse } from 'next/server'
import { isAdminRequest } from '../../../../lib/admin'
import { getPageViewStats } from '../../../../lib/analytics'

export async function GET(request: Request) {
  if (!(await isAdminRequest())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(request.url)
  const days = Number(searchParams.get('days')) || 30
  const data = await getPageViewStats({ days })
  return NextResponse.json(data)
}
