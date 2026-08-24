import { NextResponse } from 'next/server'
import { getCurrentCustomer } from '../../../../lib/customer-store'

export async function GET() {
  const customer = await getCurrentCustomer()
  if (!customer) return NextResponse.json({ customer: null })
  return NextResponse.json({ customer })
}
