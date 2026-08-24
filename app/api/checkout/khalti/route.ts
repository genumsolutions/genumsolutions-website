import { NextResponse } from 'next/server'
import { getSessionUser } from '../../../../lib/supabase/server'
import { priceRequestedItems, readCustomerFields } from '../../../../lib/checkout'
import { createOrder, setOrderRef } from '../../../../lib/orders'

export const runtime = 'nodejs'

function khaltiConfigured() {
  return Boolean(process.env.KHALTI_SECRET_KEY)
}

export async function POST(request: Request) {
  if (!khaltiConfigured()) return NextResponse.json({ error: 'Khalti is not configured.' }, { status: 503 })
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
    provider: 'khalti',
    ...customer,
  })
  if (!order) return NextResponse.json({ error: 'Could not save the order before payment.' }, { status: 500 })

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || ''
  const baseUrl = process.env.KHALTI_BASE_URL || 'https://a.khalti.com/api/v2'
  try {
    // Amounts are in paisa (1 NPR = 100 paisa).
    const response = await fetch(`${baseUrl}/epayment/initiate/`, {
      method: 'POST',
      headers: {
        Authorization: `Key ${process.env.KHALTI_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        return_url: `${siteUrl}/checkout/success?provider=khalti`,
        website_url: siteUrl || undefined,
        amount: cart.totalNpr * 100,
        purchase_order_id: order.id,
        purchase_order_name: `GENUM order ${order.id.slice(0, 8)}`,
        customer_info: {
          name: customer.customerName,
          email: customer.email,
          phone: customer.phone || undefined,
        },
      }),
    })
    const result = await response.json().catch(() => null)
    if (!response.ok || !result?.payment_url) {
      console.error('Khalti initiate failed', result ?? response.status)
      return NextResponse.json({ error: 'Payment could not be started. Try again.' }, { status: 502 })
    }
    await setOrderRef(order.id, String(result.pidx || ''))
    return NextResponse.json({ url: result.payment_url, orderId: order.id })
  } catch (error) {
    console.error('Khalti session failed', error)
    return NextResponse.json({ error: 'Payment could not be started. Try again.' }, { status: 500 })
  }
}
