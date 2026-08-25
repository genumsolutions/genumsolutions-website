import { NextResponse } from 'next/server'
import { isAdminRequest } from '../../../../lib/admin'
import { deleteProduct, getManagedProducts, saveProduct, type Product } from '../../../../lib/content-store'

export async function GET(request: Request) {
  if (!(await isAdminRequest())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const params = new URL(request.url).searchParams
  const all = await getManagedProducts()
  const needle = (params.get('q') || '').trim().toLowerCase()
  const filtered = needle
    ? all.filter((product) => `${product.id} ${product.name} ${product.sku} ${product.category}`.toLowerCase().includes(needle))
    : all
  const page = Math.max(1, Number(params.get('page')) || 1)
  const limit = Math.min(100, Math.max(5, Number(params.get('limit')) || 20))
  return NextResponse.json({
    products: filtered.slice((page - 1) * limit, page * limit),
    total: filtered.length,
    page,
    totalPages: Math.max(1, Math.ceil(filtered.length / limit)),
  })
}

export async function PUT(request: Request) {
  if (!(await isAdminRequest())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => null)
  if (!body?.id || !body?.name || !body?.category) return NextResponse.json({ error: 'Product id, name, and category are required.' }, { status: 400 })
  const specs = Array.isArray(body.specs) ? body.specs.filter((line: unknown) => typeof line === 'string' && line.trim()) : []
  const product: Product = { ...body, id: String(body.id).trim(), name: String(body.name).trim(), category: String(body.category).trim(), specs }
  await saveProduct(product)
  return NextResponse.json({ ok: true, product })
}

export async function DELETE(request: Request) {
  if (!(await isAdminRequest())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Product id is required.' }, { status: 400 })
  await deleteProduct(id)
  return NextResponse.json({ ok: true })
}
