import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getSessionUser } from '../../../../lib/supabase/server'
import { priceRequestedItems, readCustomerFields } from '../../../../lib/checkout'
import { createOrder, setOrderRef } from '../../../../lib/orders'

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null

export async function POST(request: Request) {
  if (!stripe) return NextResponse.json({ error: 'Stripe is not configured' }, { status: 503 })
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Sign in to place your order.' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const cart = await priceRequestedItems(body?.items)
  if (!cart) return NextResponse.json({ error: 'No purchasable items in your build list.' }, { status: 400 })

  const customer = readCustomerFields(body, user.email)
  const order = await createOrder({
    userId: user.id,
    items: cart.priced,
    totalNpr: cart.totalNpr,
    provider: 'stripe',
    ...customer,
  })
  if (!order) return NextResponse.json({ error: 'Could not save the order before payment.' }, { status: 500 })

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: cart.priced.map((item) => ({
        price_data: { currency: 'npr', product_data: { name: item.name }, unit_amount: item.price * 100 },
        quantity: item.quantity,
      })),
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL || ''}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL || ''}/checkout`,
      client_reference_id: order.id,
      metadata: { orderId: order.id, userId: user.id },
    })
    await setOrderRef(order.id, session.id)
    return NextResponse.json({ url: session.url, orderId: order.id })
  } catch (error) {
    console.error('Stripe session failed', error)
    return NextResponse.json({ error: 'Payment could not be started. Try again.' }, { status: 500 })
  }
}
