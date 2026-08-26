import { NextResponse } from 'next/server'
import { getManagedProducts } from '../../../lib/content-store'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    return NextResponse.json(await getManagedProducts())
  } catch (error) {
    console.error('Product list failed', error)
    return NextResponse.json({ error: 'Could not load products.' }, { status: 500 })
  }
}
