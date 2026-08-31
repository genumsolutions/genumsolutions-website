import { NextResponse } from 'next/server'
import { isAdminRequest } from '../../../../lib/admin'
import { getManagedRoBoModes, saveRoBoMode, deleteRoBoMode } from '../../../../lib/content-store'

export async function GET(request: Request) {
  if (!(await isAdminRequest())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const params = new URL(request.url).searchParams
    const all = await getManagedRoBoModes()
    const needle = (params.get('q') || '').trim().toLowerCase()
    const filtered = needle
      ? all.filter((mode) =>
          `${mode.id} ${mode.name} ${mode.token} ${mode.car}`.toLowerCase().includes(needle),
        )
      : all
    const page = Math.max(1, Number(params.get('page')) || 1)
    const limit = Math.min(100, Math.max(5, Number(params.get('limit')) || 20))
    return NextResponse.json({
      modes: filtered.slice((page - 1) * limit, page * limit),
      total: filtered.length,
      page,
      totalPages: Math.max(1, Math.ceil(filtered.length / limit)),
    })
  } catch (error) {
    console.error('Admin robo-car-modes list failed', error)
    return NextResponse.json({ error: 'Could not load modes.' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  if (!(await isAdminRequest())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await request.json().catch(() => null)
    if (!body?.id || !body?.name) return NextResponse.json({ error: 'Mode id and name are required.' }, { status: 400 })
    await saveRoBoMode(body as any)
    return NextResponse.json({ ok: true, mode: body })
  } catch (error) {
    console.error('Mode save failed', error)
    return NextResponse.json({ error: 'Could not save the mode.' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  if (!(await isAdminRequest())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await request.json().catch(() => null)
    if (!body?.id) return NextResponse.json({ error: 'Mode id is required.' }, { status: 400 })
    await saveRoBoMode(body as any)
    return NextResponse.json({ ok: true, mode: body })
  } catch (error) {
    console.error('Mode update failed', error)
    return NextResponse.json({ error: 'Could not update the mode.' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  if (!(await isAdminRequest())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const id = new URL(request.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Mode id is required.' }, { status: 400 })
    await deleteRoBoMode(id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Mode deletion failed', error)
    return NextResponse.json({ error: 'Could not delete the mode.' }, { status: 500 })
  }
}