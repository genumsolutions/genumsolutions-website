import { NextResponse } from 'next/server'
import { getSessionUser } from '../../../lib/supabase/server'
import { createOrder, listOrders } from '../../../lib/orders'
import type { OrderItem, Order } from '../../../lib/customer'

function sanitizeItems(raw: unknown): OrderItem[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((item) => item && typeof item.productId === 'string' && typeof item.name === 'string' && Number.isFinite(item.price) && Number.isFinite(item.quantity))
    .map((item) => ({ productId: item.productId.slice(0, 120), name: item.name.slice(0, 200), price: Math.max(0, Math.round(item.price)), quantity: Math.max(1, Math.min(99, Math.floor(item.quantity))) }))
    .slice(0, 50)
}

export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Sign in to see your orders.' }, { status: 401 })
  return NextResponse.json({ orders: await listOrders(user.id) })
}

// Creates a pending order. Used directly for cash-on-delivery; the Stripe route
// creates its order server-side and only redirects to the gateway afterwards.
export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Sign in to place your order.' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })

  const items = sanitizeItems(body.items)
  if (!items.length) return NextResponse.json({ error: 'Your build list is empty.' }, { status: 400 })
  const totalNpr = items.reduce((sum, item) => sum + item.price * item.quantity, 0)

  const name = String(body.customer?.name || '').trim()
  const email = String(body.customer?.email || '').trim()
  const phone = String(body.customer?.phone || '').trim()
  const address = String(body.customer?.address || '').trim()
  if (!name || !email || !address) return NextResponse.json({ error: 'Add your name, email, and delivery address.' }, { status: 400 })

  const provider = (['cod', 'esewa', 'khalti'].includes(body.provider) ? body.provider : 'cod') as Order['provider']
  const order = await createOrder({ userId: user.id, items, totalNpr, provider, customerName: name, email, phone, address })
  if (!order) return NextResponse.json({ error: 'Could not save the order. Try again.' }, { status: 500 })
  return NextResponse.json({ ok: true, order })
}
