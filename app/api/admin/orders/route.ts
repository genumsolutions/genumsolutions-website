import { NextResponse } from 'next/server'
import { isAdminRequest } from '../../../../lib/admin'
import { listOrders, updateOrderStatus } from '../../../../lib/orders'
import type { Order } from '../../../../lib/customer'

const STATUSES: Order['status'][] = ['pending', 'paid', 'fulfilled', 'cancelled']

export async function GET() {
  if (!(await isAdminRequest())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({ orders: await listOrders() })
}

export async function PATCH(request: Request) {
  if (!(await isAdminRequest())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => null)
  const status = body?.status
  if (!body?.id || !STATUSES.includes(status)) return NextResponse.json({ error: 'Valid order id and status are required.' }, { status: 400 })
  await updateOrderStatus(String(body.id), status)
  return NextResponse.json({ ok: true })
}
