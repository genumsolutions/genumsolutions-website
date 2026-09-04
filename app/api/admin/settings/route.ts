import { NextResponse } from 'next/server'
import { isAdminRequest } from '../../../../lib/admin'
import {
  getManagedSettings,
  saveCompanyInfo,
  saveTrainingProgram,
  deleteTrainingProgram,
  savePilotCostLine,
  deletePilotCostLine,
  saveCurriculumHighlight,
  deleteCurriculumHighlight,
} from '../../../../lib/settings-store'

export async function GET() {
  if (!(await isAdminRequest())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    return NextResponse.json(await getManagedSettings())
  } catch (error) {
    console.error('Admin settings load failed', error)
    return NextResponse.json({ error: 'Could not load settings.' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  if (!(await isAdminRequest())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = (await request.json().catch(() => null)) as {
      action?: string
      company?: unknown
      program?: { title?: string }
      pilotLine?: { item?: string }
      curriculum?: { ageBand?: string }
    } | null
    if (!body) return NextResponse.json({ error: 'Missing payload.' }, { status: 400 })

    switch (body.action) {
      case 'company': {
        const c = (body.company ?? {}) as Record<string, string>
        await saveCompanyInfo({
          name: c.name ?? '', shortName: c.shortName ?? '', address: c.address ?? '',
          city: c.city ?? '', country: c.country ?? '', email: c.email ?? '',
          phone: c.phone ?? '', pan: c.pan ?? '', vatLabel: c.vatLabel ?? '', description: c.description ?? '',
        })
        return NextResponse.json({ ok: true })
      }
      case 'training': {
        const p = (body.program ?? {}) as { id?: string; title?: string; audience?: string; description?: string; duration?: string; outcome?: string; active?: boolean; sortOrder?: number }
        if (!p.title?.trim()) return NextResponse.json({ error: 'Program title is required.' }, { status: 400 })
        await saveTrainingProgram({
          id: (p.id ?? '').trim() || slugify(p.title),
          title: p.title.trim(),
          audience: String(p.audience ?? '').trim(),
          description: String(p.description ?? '').trim(),
          duration: String(p.duration ?? '').trim(),
          outcome: String(p.outcome ?? '').trim(),
          active: p.active !== false,
          sortOrder: Math.max(0, Math.round(Number(p.sortOrder) || 0)),
        })
        return NextResponse.json({ ok: true, id: (p.id ?? '').trim() || slugify(p.title) })
      }
      case 'pilot': {
        const l = (body.pilotLine ?? {}) as { id?: string; item?: string; cost?: string; note?: string; active?: boolean; sortOrder?: number }
        if (!l.item?.trim()) return NextResponse.json({ error: 'Cost line item is required.' }, { status: 400 })
        const id = (l.id ?? '').trim() || `cost-${Date.now()}`
        await savePilotCostLine({
          id, item: l.item.trim(), cost: String(l.cost ?? '').trim(), note: String(l.note ?? '').trim(),
          active: l.active !== false,
          sortOrder: Math.max(0, Math.round(Number(l.sortOrder) || 0)),
        })
        return NextResponse.json({ ok: true, id })
      }
      case 'curriculum': {
        const h = (body.curriculum ?? {}) as { id?: string; ageBand?: string; items?: string[]; active?: boolean; sortOrder?: number }
        if (!h.ageBand?.trim()) return NextResponse.json({ error: 'Curriculum age band is required.' }, { status: 400 })
        const id = (h.id ?? '').trim() || `curriculum-${Date.now()}`
        await saveCurriculumHighlight({
          id, ageBand: h.ageBand.trim(), items: Array.isArray(h.items) ? h.items.map(String) : [],
          active: h.active !== false,
          sortOrder: Math.max(0, Math.round(Number(h.sortOrder) || 0)),
        })
        return NextResponse.json({ ok: true, id })
      }
      default:
        return NextResponse.json({ error: 'Unknown settings action.' }, { status: 400 })
    }
  } catch (error) {
    console.error('Admin settings save failed', error)
    return NextResponse.json({ error: 'Could not save settings.' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  if (!(await isAdminRequest())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const params = new URL(request.url).searchParams
    const action = params.get('action')
    const id = params.get('id')
    if (!id) return NextResponse.json({ error: 'id is required.' }, { status: 400 })
    switch (action) {
      case 'training': await deleteTrainingProgram(id); break
      case 'pilot': await deletePilotCostLine(id); break
      case 'curriculum': await deleteCurriculumHighlight(id); break
      default: return NextResponse.json({ error: 'Unknown settings action.' }, { status: 400 })
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Admin settings delete failed', error)
    return NextResponse.json({ error: 'Could not delete the item.' }, { status: 500 })
  }
}

function slugify(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}
