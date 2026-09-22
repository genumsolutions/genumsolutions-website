import { NextResponse } from 'next/server'
import { isAdminRequest, isStaffRequest } from '../../../../lib/admin'
import { createServiceClient } from '../../../../lib/supabase/server'
import { listOrdersPage, updateOrderStatus } from '../../../../lib/orders'
import { logActivity } from '../../../../lib/activity'
import type { Order } from '../../../../lib/customer'

const STATUSES: Order['status'][] = ['pending', 'paid', 'fulfilled', 'cancelled']

export async function GET(request: Request) {
  if (!(await isStaffRequest())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
  if (!(await isStaffRequest())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => null)
  const status = body?.status
  if (!body?.id || !STATUSES.includes(status)) return NextResponse.json({ error: 'Valid order id and status are required.' }, { status: 400 })
  await updateOrderStatus(String(body.id), status)
  await logActivity({ action: 'order.status_changed', entityType: 'order', entityId: String(body.id), details: { status } })
  return NextResponse.json({ ok: true })
}

// Delete an order (admin action). The order row + its transactions keep the
// ledger consistent: transactions rows reference the order and are removed
// with it (cascade), so Finance totals stay truthful.
export async function DELETE(request: Request) {
  if (!(await isAdminRequest())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id.' }, { status: 400 })
  try {
    const db = createServiceClient()
    const { error } = await db.from('orders').delete().eq('id', id)
    if (error) return NextResponse.json({ error: 'Could not delete the order.' }, { status: 500 })
    await logActivity({ action: 'order.deleted', entityType: 'order', entityId: id, details: {} })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Order delete failed', error)
    return NextResponse.json({ error: 'Could not delete the order.' }, { status: 500 }
    )
  }
}
