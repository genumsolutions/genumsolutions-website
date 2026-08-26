import { NextResponse } from 'next/server'
import { isAdminRequest } from '../../../../lib/admin'
import { listActivity } from '../../../../lib/activity'

export async function GET(request: Request) {
  if (!(await isAdminRequest())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { searchParams } = new URL(request.url)
    const page = Number(searchParams.get('page')) || 1
    const limit = Number(searchParams.get('limit')) || 20
    const entityType = searchParams.get('entityType') || undefined
    const data = await listActivity({ page, limit, entityType })
    return NextResponse.json(data)
  } catch (error) {
    console.error('Activity log failed', error)
    return NextResponse.json({ error: 'Could not load activity.' }, { status: 500 })
  }
}
