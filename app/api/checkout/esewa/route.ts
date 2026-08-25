import { NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { getSessionUser } from '../../../../lib/supabase/server'
import { priceRequestedItems, readCustomerFields } from '../../../../lib/checkout'
import { createOrder, logTransaction, setOrderRef } from '../../../../lib/orders'

export const runtime = 'nodejs'

function esewaConfigured() {
  return Boolean(process.env.ESEWA_SECRET_KEY)
}

// Builds the eSewa ePay v2 signature: base64(HMAC-SHA256(secret, signed fields joined as k=v,...)).
function signFields(fields: Record<string, string>, secret: string) {
  const names = fields.signed_field_names.split(',')
  const message = names.map((name) => `${name}=${fields[name]}`).join(',')
  return crypto.createHmac('sha256', secret).update(message).digest('base64')
}

export async function POST(request: Request) {
  if (!esewaConfigured()) return NextResponse.json({ error: 'eSewa is not configured.' }, { status: 503 })
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
    provider: 'esewa',
    ...customer,
  })
  if (!order) return NextResponse.json({ error: 'Could not save the order before payment.' }, { status: 500 })

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || ''
  const baseUrl = process.env.ESEWA_BASE_URL || 'https://uat.esewa.com.np'
  const productCode = process.env.ESEWA_PRODUCT_CODE || 'EPAYTEST'

  // The order id doubles as transaction_uuid so the callback can find the order
  // even before any gateway reference exists.
  const fields: Record<string, string> = {
    amount: String(cart.totalNpr),
    tax_amount: '0',
    total_amount: String(cart.totalNpr),
    transaction_uuid: order.id,
    product_code: productCode,
    success_url: `${siteUrl}/checkout/success?provider=esewa`,
    failure_url: `${siteUrl}/checkout`,
    signed_field_names: 'total_amount,transaction_uuid,product_code',
  }
  try {
    fields.signature = signFields(fields, process.env.ESEWA_SECRET_KEY!)
  } catch (error) {
    console.error('eSewa signing failed', error)
    await logTransaction({ orderId: order.id, userId: user.id, provider: 'esewa', amountNpr: cart.totalNpr, status: 'failed', rawPayload: { error: 'signing-failed' } })
    return NextResponse.json({ error: 'Payment could not be started. Try again.' }, { status: 500 })
  }

  await logTransaction({ orderId: order.id, userId: user.id, provider: 'esewa', providerRef: order.id, amountNpr: cart.totalNpr, status: 'initiated', rawPayload: { transactionUuid: order.id } })
  return NextResponse.json({ action: `${baseUrl}/epay/main`, fields, orderId: order.id })
}
