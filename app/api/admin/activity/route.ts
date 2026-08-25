import { NextResponse } from 'next/server'
import { isAdminRequest } from '../../../../lib/admin'
import { listActivity } from '../../../../lib/activity'

export async function GET(request: Request) {
  if (!(await isAdminRequest())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(request.url)
  const page = Number(searchParams.get('page')) || 1
  const limit = Number(searchParams.get('limit')) || 20
  const entityType = searchParams.get('entityType') || undefined
  const data = await listActivity({ page, limit, entityType })
  return NextResponse.json(data)
}
