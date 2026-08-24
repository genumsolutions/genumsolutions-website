import { NextResponse } from 'next/server'
import { getSessionUser } from '../../../../../lib/supabase/server'
import { findOrderById, markOrderPaidAndClearCart, setOrderRef } from '../../../../../lib/orders'

export const runtime = 'nodejs'

type EsewaCallback = {
  product_code?: string
  transaction_uuid?: string
  total_amount?: string | number
  transaction_code?: string
  status?: string
}

// eSewa redirects back with ?data=<base64 JSON>. We never trust that payload -
// the order is only marked paid after the server-to-server status check says COMPLETE.
export async function GET(request: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const secret = process.env.ESEWA_SECRET_KEY
  if (!secret) return NextResponse.json({ ok: false, reason: 'esewa-not-configured' })

  const raw = new URL(request.url).searchParams.get('data')
  if (!raw) return NextResponse.json({ error: 'Missing eSewa response.' }, { status: 400 })

  let payload: EsewaCallback
  try {
    payload = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'))
  } catch {
    return NextResponse.json({ error: 'Invalid eSewa response.' }, { status: 400 })
  }
  const orderId = String(payload.transaction_uuid || '')
  const order = await findOrderById(orderId)
  if (!order || order.provider !== 'esewa') return NextResponse.json({ ok: true, matched: false })
  if (order.userId !== user.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  if (Number(payload.total_amount) !== order.totalNpr) {
    console.error('eSewa amount mismatch', payload.total_amount, order.totalNpr)
    return NextResponse.json({ ok: false, reason: 'amount-mismatch' })
  }

  const baseUrl = process.env.ESEWA_BASE_URL || 'https://uat.esewa.com.np'
  const productCode = process.env.ESEWA_PRODUCT_CODE || 'EPAYTEST'
  try {
    const auth = Buffer.from(`${productCode}:${secret}`).toString('base64')
    const params = new URLSearchParams({
      product_code: productCode,
      total_amount: String(order.totalNpr),
      transaction_uuid: orderId,
    })
    const response = await fetch(`${baseUrl}/api/epay/status?${params}`, {
      headers: { Authorization: `Basic ${auth}` },
    })
    const result = await response.json().catch(() => null)
    if (!response.ok || result?.status !== 'COMPLETE') {
      console.error('eSewa status not complete', result?.status ?? response.status)
      return NextResponse.json({ ok: false, reason: 'not-paid' })
    }
  } catch (error) {
    console.error('eSewa verification failed', error)
    return NextResponse.json({ error: 'Could not verify the payment.' }, { status: 500 })
  }

  await setOrderRef(order.id, String(payload.transaction_code || ''))
  await markOrderPaidAndClearCart(order)
  return NextResponse.json({ ok: true, matched: true, order: { id: order.id, totalNpr: order.totalNpr } })
}
