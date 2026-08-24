import { NextResponse } from 'next/server'
import { getSessionUser, supabaseConfigured } from '../../../lib/supabase/server'
import { getCart, mergeCart, saveCart } from '../../../lib/customer-store'
import type { CartLine } from '../../../lib/customer'

export async function GET() {
  if (!supabaseConfigured()) return NextResponse.json({ authenticated: false, cart: [] })
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ authenticated: false, cart: [] })
  return NextResponse.json({ authenticated: true, cart: await getCart(user.id) })
}

export async function PUT(request: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Sign in to save your cart.' }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  const incoming = Array.isArray(body.cart)
    ? body.cart
        .filter((line: CartLine) => typeof line.productId === 'string' && Number.isFinite(line.quantity) && line.quantity > 0)
        .map((line: CartLine) => ({ productId: line.productId, quantity: Math.floor(line.quantity) }))
    : []
  const current = await getCart(user.id)
  const cart = mergeCart(current, incoming)
  await saveCart(user.id, cart)
  return NextResponse.json({ cart })
}
