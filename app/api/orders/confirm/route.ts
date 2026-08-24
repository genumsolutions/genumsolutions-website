import { NextResponse } from 'next/server'
import { getSessionUser } from '../../../../lib/supabase/server'
import { findOrderByRef, markOrderPaidAndClearCart } from '../../../../lib/orders'

// Stripe redirects back here with ?session_id=...; we verify server-side instead of
// trusting the redirect. (A webhook is the production-grade upgrade - see README.)
export async function GET(request: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const sessionId = new URL(request.url).searchParams.get('session_id')
  if (!sessionId || !/^cs_[A-Za-z0-9]+$/.test(sessionId)) return NextResponse.json({ error: 'Missing checkout session.' }, { status: 400 })

  const secret = process.env.STRIPE_SECRET_KEY
  if (!secret) return NextResponse.json({ ok: false, reason: 'stripe-not-configured' })

  try {
    const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
      headers: { Authorization: `Bearer ${secret}` },
    })
    const session = await response.json()
    if (!response.ok || session.payment_status !== 'paid') return NextResponse.json({ ok: false, reason: 'not-paid' })

    const order = await findOrderByRef(sessionId)
    if (!order) return NextResponse.json({ ok: true, matched: false })
    if (order.userId !== user.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    await markOrderPaidAndClearCart(order)
    return NextResponse.json({ ok: true, matched: true, order: { id: order.id, totalNpr: order.totalNpr } })
  } catch (error) {
    console.error('Stripe confirmation failed', error)
    return NextResponse.json({ error: 'Could not confirm the payment.' }, { status: 500 })
  }
}
