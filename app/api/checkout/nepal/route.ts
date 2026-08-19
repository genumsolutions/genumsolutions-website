import { NextResponse } from 'next/server'

// Keep eSewa/Khalti signing on the server. Replace this adapter with the gateway SDK and callback verification.
export async function POST(request: Request) {
  const { provider, items } = await request.json()
  if (!['esewa', 'khalti'].includes(provider)) return NextResponse.json({ error: 'Unsupported Nepal payment provider' }, { status: 400 })
  const amount = items.reduce((total: number, item: { price: number; quantity: number }) => total + item.price * item.quantity, 0)
  return NextResponse.json({ provider, amount, status: 'adapter-ready', message: 'Create a signed gateway request on the server.' })
}
