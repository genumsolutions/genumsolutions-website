import { NextResponse } from 'next/server'
import { isAdminRequest } from '../../../../lib/admin'
import { getManagedProducts, saveProduct, type Product } from '../../../../lib/content-store'

export async function GET() {
  if (!isAdminRequest()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json(await getManagedProducts())
}

export async function PUT(request: Request) {
  if (!isAdminRequest()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const product = await request.json().catch(() => null) as Product | null
  if (!product?.id || !product.name || !product.category) return NextResponse.json({ error: 'Product id, name, and category are required.' }, { status: 400 })
  await saveProduct(product)
  return NextResponse.json({ ok: true, product })
}
