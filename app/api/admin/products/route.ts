import { NextResponse } from 'next/server'
import { isAdminRequest } from '../../../../lib/admin'
import { deleteProduct, getManagedProducts, saveProduct, type Product } from '../../../../lib/content-store'

export async function GET() {
  if (!(await isAdminRequest())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json(await getManagedProducts())
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
