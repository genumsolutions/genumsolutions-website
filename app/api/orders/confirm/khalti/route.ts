import { NextResponse } from 'next/server'
import { getSessionUser } from '../../../../../lib/supabase/server'
import { findOrderById, markOrderPaidAndClearCart } from '../../../../../lib/orders'

export const runtime = 'nodejs'

// Khalti redirects back to return_url with pidx + purchase_order_id. The order is
// only marked paid after the server-to-server lookup reports Completed and the
// paisa amount matches what we charged.
export async function GET(request: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const secret = process.env.KHALTI_SECRET_KEY
  if (!secret) return NextResponse.json({ ok: false, reason: 'khalti-not-configured' })

  const params = new URL(request.url).searchParams
  const pidx = params.get('pidx') || ''
  const purchaseOrderId = params.get('purchase_order_id') || ''
  if (!pidx || !/^[A-Za-z0-9_-]{8,128}$/.test(pidx)) {
    return NextResponse.json({ error: 'Missing Khalti payment reference.' }, { status: 400 })
  }
  const order = await findOrderById(purchaseOrderId)
  if (!order || order.provider !== 'khalti') return NextResponse.json({ ok: true, matched: false })
  if (order.userId !== user.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const baseUrl = process.env.KHALTI_BASE_URL || 'https://a.khalti.com/api/v2'
  try {
    const response = await fetch(`${baseUrl}/epayment/lookup/`, {
      method: 'POST',
      headers: {
        Authorization: `Key ${secret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ pidx }),
    })
    const result = await response.json().catch(() => null)
    if (!response.ok) {
      console.error('Khalti lookup failed', result ?? response.status)
      return NextResponse.json({ ok: false, reason: 'lookup-failed' })
    }
    if (result?.status !== 'Completed') return NextResponse.json({ ok: false, reason: 'not-paid' })
    if (Number(result.total_amount) !== order.totalNpr * 100) {
      console.error('Khalti amount mismatch', result?.total_amount, order.totalNpr * 100)
      return NextResponse.json({ ok: false, reason: 'amount-mismatch' })
    }
    await markOrderPaidAndClearCart(order)
    return NextResponse.json({ ok: true, matched: true, order: { id: order.id, totalNpr: order.totalNpr } })
  } catch (error) {
    console.error('Khalti verification failed', error)
    return NextResponse.json({ error: 'Could not verify the payment.' }, { status: 500 })
  }
}
