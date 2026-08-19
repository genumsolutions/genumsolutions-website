import { NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null

export async function POST(request: Request) {
  if (!stripe) return NextResponse.json({ error: 'Stripe is not configured' }, { status: 503 })
  const { items } = await request.json()
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: items.map((item: { name: string; price: number; quantity: number }) => ({ price_data: { currency: 'npr', product_data: { name: item.name }, unit_amount: item.price * 100 }, quantity: item.quantity })),
    success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/checkout/success`,
    cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/products`,
  })
  return NextResponse.json({ url: session.url })
}
