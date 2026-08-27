import { NextResponse } from 'next/server'
import { isAdminRequest } from '../../../../lib/admin'
import { listServices, saveService, deleteService } from '../../../../lib/services'
import { logActivity } from '../../../../lib/activity'

export async function GET() {
  if (!(await isAdminRequest())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const services = await listServices(true)
  return NextResponse.json({ services })
}

export async function PUT(request: Request) {
  if (!(await isAdminRequest())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => null)
  if (!body?.id || !body?.name) return NextResponse.json({ error: 'id and name are required.' }, { status: 400 })
  if (String(body.name).trim().length > 200) return NextResponse.json({ error: 'Name is too long (max 200).' }, { status: 400 })
  const sortOrder = Number(body.sortOrder)
  if (body.sortOrder != null && (!Number.isInteger(sortOrder) || sortOrder < 0)) return NextResponse.json({ error: 'Sort order must be a whole number of zero or more.' }, { status: 400 })

  const service = await saveService({
    id: body.id.trim().toLowerCase().replace(/\s+/g, '-').slice(0, 120),
    name: String(body.name).trim(),
    category: String(body.category ?? 'General').slice(0, 80),
    priceLabel: String(body.priceLabel ?? 'Request quote').slice(0, 80),
    description: String(body.description ?? '').slice(0, 2000),
    tag: String(body.tag ?? '').slice(0, 80),
    sortOrder: Number.isInteger(sortOrder) ? sortOrder : 1000,
    active: body.active !== false,
  })

  await logActivity({ action: 'service.saved', entityType: 'service', entityId: service.id, details: { name: service.name } })
  return NextResponse.json({ ok: true, service })
}

export async function DELETE(request: Request) {
  if (!(await isAdminRequest())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id.' }, { status: 400 })

  const ok = await deleteService(id)
  if (ok) await logActivity({ action: 'service.deleted', entityType: 'service', entityId: id })
  return NextResponse.json({ ok })
}
