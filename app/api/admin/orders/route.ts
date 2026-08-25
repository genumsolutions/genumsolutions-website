import { NextResponse } from 'next/server'
import { isAdminRequest } from '../../../../lib/admin'
import { listOrdersPage, updateOrderStatus } from '../../../../lib/orders'
import type { Order } from '../../../../lib/customer'

const STATUSES: Order['status'][] = ['pending', 'paid', 'fulfilled', 'cancelled']

export async function GET(request: Request) {
  if (!(await isAdminRequest())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const params = new URL(request.url).searchParams
  const status = params.get('status')
  const result = await listOrdersPage({
    page: Number(params.get('page')) || 1,
    limit: Number(params.get('limit')) || 10,
    status: STATUSES.includes(status as Order['status']) ? (status as Order['status']) : undefined,
    query: params.get('q') || '',
  })
  return NextResponse.json(result)
}

export async function PATCH(request: Request) {
  if (!(await isAdminRequest())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => null)
  const status = body?.status
  if (!body?.id || !STATUSES.includes(status)) return NextResponse.json({ error: 'Valid order id and status are required.' }, { status: 400 })
  await updateOrderStatus(String(body.id), status)
  return NextResponse.json({ ok: true })
}
