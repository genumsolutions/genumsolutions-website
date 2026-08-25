import { NextResponse } from 'next/server'
import { getSessionUser, supabaseConfigured } from '../../../lib/supabase/server'
import { getCart, saveCart } from '../../../lib/customer-store'
import { getManagedProducts } from '../../../lib/content-store'
import { MAX_QUANTITY_PER_LINE } from '../../../lib/cart-client'
import type { CartLine } from '../../../lib/customer'

export async function GET() {
  if (!supabaseConfigured()) return NextResponse.json({ authenticated: false, cart: [] })
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ authenticated: false, cart: [] })
  return NextResponse.json({ authenticated: true, cart: await getCart(user.id) })
}

// REPLACE semantics: the client sends its full intended cart; quantities are
// clamped to live stock from the database before saving. This is what keeps
// the stored bucket quantity exactly equal to what the shopper sees.
export async function PUT(request: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Sign in to save your cart.' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const incoming: CartLine[] = Array.isArray(body?.cart)
    ? body.cart
        .filter((line: CartLine) => typeof line?.productId === 'string' && Number.isFinite(line?.quantity))
        .map((line: CartLine) => ({
          productId: line.productId,
          quantity: Math.max(0, Math.min(MAX_QUANTITY_PER_LINE, Math.floor(line.quantity))),
        }))
        .filter((line: CartLine) => line.productId.length > 0)
    : []

  const catalog = await getManagedProducts()
  const stockById = new Map(catalog.map((product) => [product.id, Math.max(0, product.stock)]))
  const seen = new Set<string>()
  const cart: CartLine[] = []
  for (const line of incoming) {
    const stock = stockById.get(line.productId)
    // Unknown or out-of-stock products are dropped - they cannot be purchased.
    if (!stock || seen.has(line.productId)) continue
    const quantity = Math.min(line.quantity, stock)
    if (quantity <= 0) continue
    seen.add(line.productId)
    cart.push({ productId: line.productId, quantity })
  }

  const saved = await saveCart(user.id, cart)
  return NextResponse.json({ cart: saved ?? cart })
}
