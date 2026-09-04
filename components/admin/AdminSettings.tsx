'use client'

import { FormEvent, useEffect, useState } from 'react'
import { inputClass } from '../../lib/styles'

type Props = { setMessage: (msg: string) => void }

type CompanyInfo = {
  name: string; shortName: string; address: string; city: string; country: string;
  email: string; phone: string; pan: string; vatLabel: string; description: string
}

type TrainingProgram = {
  id: string; title: string; audience: string; description: string; duration: string;
  outcome: string; active: boolean; sortOrder: number
}

type PilotCostLine = {
  id: string; item: string; cost: string; note: string; active: boolean; sortOrder: number
}

type CurriculumHighlight = {
  id: string; ageBand: string; items: string[]; active: boolean; sortOrder: number
}

const emptyCompany: CompanyInfo = {
  name: '', shortName: '', address: '', city: '', country: '',
  email: '', phone: '', pan: '', vatLabel: '', description: '',
}

export default function AdminSettings({ setMessage }: Props) {
  const [loaded, setLoaded] = useState(false)
  const [company, setCompany] = useState<CompanyInfo>(emptyCompany)
  const [programs, setPrograms] = useState<TrainingProgram[]>([])
  const [pilots, setPilots] = useState<PilotCostLine[]>([])
  const [curricula, setCurricula] = useState<CurriculumHighlight[]>([])

  const [program, setProgram] = useState<Partial<TrainingProgram> | null>(null)
  const [pilot, setPilot] = useState<Partial<PilotCostLine> | null>(null)
  const [curriculum, setCurriculum] = useState<Partial<CurriculumHighlight> | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void fetch('/api/admin/settings')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        setCompany(data.company ?? emptyCompany)
        setPrograms(data.trainingPrograms ?? [])
        setPilots(data.pilotCostLines ?? [])
        setCurricula(data.curriculumHighlights ?? [])
      })
      .catch(() => setMessage('Could not load settings.'))
      .finally(() => setLoaded(true))
  }, [setMessage])

  async function saveCompanyInfo(event?: FormEvent) {
    event?.preventDefault()
    if (!company.name.trim() || !company.email.trim()) { setMessage('Company name and email are required.'); return }
    setBusy(true)
    const response = await fetch('/api/admin/settings', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'company', company }),
    })
    const result = await response.json().catch(() => ({}))
    setBusy(false)
    if (!response.ok) { setMessage(result.error || 'Could not save company info.'); return }
    setMessage('Company info saved (updates across the site within ~5 min).')
  }

  async function saveProgram(event?: FormEvent) {
    event?.preventDefault()
    if (!program?.title?.trim()) { setMessage('Program title is required.'); return }
    setBusy(true)
    const response = await fetch('/api/admin/settings', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'training', program: { ...program, title: program.title.trim() } }),
    })
    const result = await response.json().catch(() => ({}))
    setBusy(false)
    if (!response.ok) { setMessage(result.error || 'Could not save program.'); return }
    await refresh('training')
    setProgram(null)
    setMessage('Training program saved.')
  }

  async function removeProgram(id: string) {
    if (!window.confirm(`Delete training program ${id}?`)) return
    const response = await fetch(`/api/admin/settings?action=training&id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    if (response.ok) { setPrograms((c) => c.filter((p) => p.id !== id)); setMessage('Training program deleted.') }
  }

  async function savePilot(event?: FormEvent) {
    event?.preventDefault()
    if (!pilot?.item?.trim()) { setMessage('Cost line item is required.'); return }
    setBusy(true)
    const response = await fetch('/api/admin/settings', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'pilot', pilotLine: { ...pilot, item: pilot.item.trim() } }),
    })
    const result = await response.json().catch(() => ({}))
    setBusy(false)
    if (!response.ok) { setMessage(result.error || 'Could not save cost line.'); return }
    await refresh('pilot')
    setPilot(null)
    setMessage('Pilot cost line saved.')
  }

  async function removePilot(id: string) {
    if (!window.confirm(`Delete pilot cost line ${id}?`)) return
    const response = await fetch(`/api/admin/settings?action=pilot&id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    if (response.ok) { setPilots((c) => c.filter((l) => l.id !== id)); setMessage('Pilot cost line deleted.') }
  }

  async function saveCurriculum(event?: FormEvent) {
    event?.preventDefault()
    if (!curriculum?.ageBand?.trim()) { setMessage('Curriculum age band is required.'); return }
    setBusy(true)
    const response = await fetch('/api/admin/settings', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'curriculum', curriculum: { ...curriculum, ageBand: curriculum.ageBand.trim() } }),
    })
    const result = await response.json().catch(() => ({}))
    setBusy(false)
    if (!response.ok) { setMessage(result.error || 'Could not save curriculum highlight.'); return }
    await refresh('curriculum')
    setCurriculum(null)
    setMessage('Curriculum highlight saved.')
  }

  async function removeCurriculum(id: string) {
    if (!window.confirm(`Delete curriculum highlight ${id}?`)) return
    const response = await fetch(`/api/admin/settings?action=curriculum&id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    if (response.ok) { setCurricula((c) => c.filter((h) => h.id !== id)); setMessage('Curriculum highlight deleted.') }
  }

  async function refresh(kind: 'training' | 'pilot' | 'curriculum') {
    try {
      const r = await fetch('/api/admin/settings')
      const data = await r.json()
      if (kind === 'training') setPrograms(data.trainingPrograms ?? [])
      else if (kind === 'pilot') setPilots(data.pilotCostLines ?? [])
      else setCurricula(data.curriculumHighlights ?? [])
    } catch {
      // ignore reload errors; keep local state
    }
  }

  if (!loaded) {
    return (
      <div role="tabpanel" id="panel-settings" aria-labelledby="tab-settings" className="mt-8">
        <p className="text-sm text-slate-500" role="status">Loading…</p>
      </div>
    )
  }

  return (
    <div role="tabpanel" id="panel-settings" aria-labelledby="tab-settings" className="mt-8 grid min-w-0 gap-8 xl:grid-cols-2">
      {/* Company info */}
      <section aria-label="Company information" className="min-w-0 border-t-2 border-ink bg-white p-6">
        <h2 className="font-display text-2xl font-bold">Company information</h2>
        <p className="mt-1 text-xs text-slate-500">Shown on the app Contact/Legal screens and the website footer/contact pages.</p>
        <form onSubmit={saveCompanyInfo} className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="min-w-0 text-sm font-bold">Name<input value={company.name} onChange={(e) => setCompany({ ...company, name: e.target.value })} className={`mt-2 w-full ${inputClass}`} /></label>
          <label className="min-w-0 text-sm font-bold">Short name<input value={company.shortName} onChange={(e) => setCompany({ ...company, shortName: e.target.value })} className={`mt-2 w-full ${inputClass}`} /></label>
          <label className="min-w-0 text-sm font-bold sm:col-span-2">Address<textarea value={company.address} onChange={(e) => setCompany({ ...company, address: e.target.value })} rows={2} className={`mt-2 w-full ${inputClass}`} /></label>
          <label className="min-w-0 text-sm font-bold">City<input value={company.city} onChange={(e) => setCompany({ ...company, city: e.target.value })} className={`mt-2 w-full ${inputClass}`} /></label>
          <label className="min-w-0 text-sm font-bold">Country<input value={company.country} onChange={(e) => setCompany({ ...company, country: e.target.value })} className={`mt-2 w-full ${inputClass}`} /></label>
          <label className="min-w-0 text-sm font-bold">Email<input type="email" value={company.email} onChange={(e) => setCompany({ ...company, email: e.target.value })} className={`mt-2 w-full ${inputClass}`} /></label>
          <label className="min-w-0 text-sm font-bold">Phone<input value={company.phone} onChange={(e) => setCompany({ ...company, phone: e.target.value })} className={`mt-2 w-full ${inputClass}`} /></label>
          <label className="min-w-0 text-sm font-bold">PAN<input value={company.pan} onChange={(e) => setCompany({ ...company, pan: e.target.value })} className={`mt-2 w-full ${inputClass}`} /></label>
          <label className="min-w-0 text-sm font-bold">VAT label<input value={company.vatLabel} onChange={(e) => setCompany({ ...company, vatLabel: e.target.value })} className={`mt-2 w-full ${inputClass}`} /></label>
          <label className="min-w-0 text-sm font-bold sm:col-span-2">Description<textarea value={company.description} onChange={(e) => setCompany({ ...company, description: e.target.value })} rows={4} className={`mt-2 w-full ${inputClass}`} /></label>
          <button type="submit" disabled={busy} className="justify-self-start bg-navy px-5 py-3 text-sm font-black text-white transition hover:bg-navy/90 disabled:opacity-60">{busy ? 'Saving...' : 'Save company'}</button>
        </form>
      </section>

      {/* Training programs */}
      <section aria-label="Training programs" className="min-w-0 border-t-2 border-ink bg-white p-6">
        <h2 className="font-display text-xl font-bold">Training programs ({programs.length})</h2>
        <p className="mt-1 text-xs text-slate-500">Shown on the app home screen and the website /services page.</p>
        <button onClick={() => setProgram({})} className="mt-4 bg-navy px-4 py-2 text-xs font-black text-white transition hover:bg-navy/90">+ New program</button>
        {program && (
          <form onSubmit={saveProgram} className="mt-4 grid gap-3 rounded-lg border border-line bg-surface p-4">
            <h3 className="text-sm font-bold text-ink">{program.id ? `Edit ${program.id}` : 'Add a training program'}</h3>
            <label className="text-sm font-bold">Title<input value={program.title ?? ''} onChange={(e) => setProgram({ ...program, title: e.target.value })} className={`mt-1 w-full ${inputClass}`} /></label>
            <label className="text-sm font-bold">Audience<input value={program.audience ?? ''} onChange={(e) => setProgram({ ...program, audience: e.target.value })} className={`mt-1 w-full ${inputClass}`} placeholder="Students / Teachers / Makers" /></label>
            <label className="text-sm font-bold">Duration<input value={program.duration ?? ''} onChange={(e) => setProgram({ ...program, duration: e.target.value })} className={`mt-1 w-full ${inputClass}`} placeholder="2 hours / 4 sessions" /></label>
            <label className="text-sm font-bold">Description<textarea value={program.description ?? ''} onChange={(e) => setProgram({ ...program, description: e.target.value })} rows={3} className={`mt-1 w-full ${inputClass}`} /></label>
            <label className="text-sm font-bold">Outcome<textarea value={program.outcome ?? ''} onChange={(e) => setProgram({ ...program, outcome: e.target.value })} rows={2} className={`mt-1 w-full ${inputClass}`} /></label>
            <label className="text-sm font-bold">Sort order<input type="number" value={program.sortOrder ?? 0} onChange={(e) => setProgram({ ...program, sortOrder: Number(e.target.value) })} className={`mt-1 w-full ${inputClass}`} /></label>
            <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={program.active !== false} onChange={(e) => setProgram({ ...program, active: e.target.checked })} className="h-4 w-4" /> Active</label>
            <div className="flex gap-2">
              <button type="submit" disabled={busy} className="bg-gold px-4 py-2 text-xs font-black text-ink transition hover:bg-gold-dark disabled:opacity-60">{busy ? 'Saving...' : 'Save'}</button>
              <button type="button" onClick={() => setProgram(null)} className="border border-line px-4 py-2 text-xs font-black text-ink transition hover:border-navy">Cancel</button>
            </div>
          </form>
        )}
        <div className="mt-4 divide-y divide-line">
          {programs.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span className="min-w-0 flex-1"><span className="block text-sm"><strong>{p.title}</strong> <span className="text-slate-400">{p.audience}</span></span></span>
              <span className="flex shrink-0 gap-2">
                <button onClick={() => setProgram({ ...p })} className="text-xs font-bold text-navy underline">Edit</button>
                <button onClick={() => removeProgram(p.id)} className="text-xs font-bold text-red-600 underline">Delete</button>
              </span>
            </div>
          ))}
          {programs.length === 0 && <p className="py-3 text-sm text-slate-500">No training programs yet.</p>}
        </div>
      </section>

      {/* Pilot costs */}
      <section aria-label="Pilot cost lines" className="min-w-0 border-t-2 border-ink bg-white p-6">
        <h2 className="font-display text-xl font-bold">Pilot cost lines ({pilots.length})</h2>
        <p className="mt-1 text-xs text-slate-500">Running costs shown on the app home screen.</p>
        <button onClick={() => setPilot({})} className="mt-4 bg-navy px-4 py-2 text-xs font-black text-white transition hover:bg-navy/90">+ New cost line</button>
        {pilot && (
          <form onSubmit={savePilot} className="mt-4 grid gap-3 rounded-lg border border-line bg-surface p-4">
            <h3 className="text-sm font-bold text-ink">{pilot.id ? `Edit ${pilot.id}` : 'Add a cost line'}</h3>
            <label className="text-sm font-bold">Item<input value={pilot.item ?? ''} onChange={(e) => setPilot({ ...pilot, item: e.target.value })} className={`mt-1 w-full ${inputClass}`} /></label>
            <label className="text-sm font-bold">Cost<input value={pilot.cost ?? ''} onChange={(e) => setPilot({ ...pilot, cost: e.target.value })} className={`mt-1 w-full ${inputClass}`} placeholder="NPR 25,000 / month" /></label>
            <label className="text-sm font-bold">Note<input value={pilot.note ?? ''} onChange={(e) => setPilot({ ...pilot, note: e.target.value })} className={`mt-1 w-full ${inputClass}`} /></label>
            <label className="text-sm font-bold">Sort order<input type="number" value={pilot.sortOrder ?? 0} onChange={(e) => setPilot({ ...pilot, sortOrder: Number(e.target.value) })} className={`mt-1 w-full ${inputClass}`} /></label>
            <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={pilot.active !== false} onChange={(e) => setPilot({ ...pilot, active: e.target.checked })} className="h-4 w-4" /> Active</label>
            <div className="flex gap-2">
              <button type="submit" disabled={busy} className="bg-gold px-4 py-2 text-xs font-black text-ink transition hover:bg-gold-dark disabled:opacity-60">{busy ? 'Saving...' : 'Save'}</button>
              <button type="button" onClick={() => setPilot(null)} className="border border-line px-4 py-2 text-xs font-black text-ink transition hover:border-navy">Cancel</button>
            </div>
          </form>
        )}
        <div className="mt-4 divide-y divide-line">
          {pilots.map((l) => (
            <div key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span className="min-w-0 flex-1"><span className="block text-sm"><strong>{l.item}</strong> <span className="text-slate-400">{l.cost}</span></span></span>
              <span className="flex shrink-0 gap-2">
                <button onClick={() => setPilot({ ...l })} className="text-xs font-bold text-navy underline">Edit</button>
                <button onClick={() => removePilot(l.id)} className="text-xs font-bold text-red-600 underline">Delete</button>
              </span>
            </div>
          ))}
          {pilots.length === 0 && <p className="py-3 text-sm text-slate-500">No pilot cost lines yet.</p>}
        </div>
      </section>

      {/* Curriculum highlights */}
      <section aria-label="Curriculum highlights" className="min-w-0 border-t-2 border-ink bg-white p-6">
        <h2 className="font-display text-xl font-bold">Curriculum highlights ({curricula.length})</h2>
        <p className="mt-1 text-xs text-slate-500">Age-band curriculum skills shown on the app home screen.</p>
        <button onClick={() => setCurriculum({})} className="mt-4 bg-navy px-4 py-2 text-xs font-black text-white transition hover:bg-navy/90">+ New highlight</button>
        {curriculum && (
          <form onSubmit={saveCurriculum} className="mt-4 grid gap-3 rounded-lg border border-line bg-surface p-4">
            <h3 className="text-sm font-bold text-ink">{curriculum.id ? `Edit ${curriculum.id}` : 'Add a curriculum highlight'}</h3>
            <label className="text-sm font-bold">Age band<input value={curriculum.ageBand ?? ''} onChange={(e) => setCurriculum({ ...curriculum, ageBand: e.target.value })} className={`mt-1 w-full ${inputClass}`} placeholder="Ages 8-11" /></label>
            <label className="text-sm font-bold">Skills / items (one per line)<textarea value={(curriculum.items ?? []).join('\n')} onChange={(e) => setCurriculum({ ...curriculum, items: toStringArrayLines(e.target.value) })} rows={4} className={`mt-1 w-full ${inputClass}`} /></label>
            <label className="text-sm font-bold">Sort order<input type="number" value={curriculum.sortOrder ?? 0} onChange={(e) => setCurriculum({ ...curriculum, sortOrder: Number(e.target.value) })} className={`mt-1 w-full ${inputClass}`} /></label>
            <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={curriculum.active !== false} onChange={(e) => setCurriculum({ ...curriculum, active: e.target.checked })} className="h-4 w-4" /> Active</label>
            <div className="flex gap-2">
              <button type="submit" disabled={busy} className="bg-gold px-4 py-2 text-xs font-black text-ink transition hover:bg-gold-dark disabled:opacity-60">{busy ? 'Saving...' : 'Save'}</button>
              <button type="button" onClick={() => setCurriculum(null)} className="border border-line px-4 py-2 text-xs font-black text-ink transition hover:border-navy">Cancel</button>
            </div>
          </form>
        )}
        <div className="mt-4 divide-y divide-line">
          {curricula.map((h) => (
            <div key={h.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span className="min-w-0 flex-1"><span className="block text-sm"><strong>{h.ageBand}</strong> <span className="text-slate-400">({h.items.length} skills)</span></span></span>
              <span className="flex shrink-0 gap-2">
                <button onClick={() => setCurriculum({ ...h })} className="text-xs font-bold text-navy underline">Edit</button>
                <button onClick={() => removeCurriculum(h.id)} className="text-xs font-bold text-red-600 underline">Delete</button>
              </span>
            </div>
          ))}
          {curricula.length === 0 && <p className="py-3 text-sm text-slate-500">No curriculum highlights yet.</p>}
        </div>
      </section>
    </div>
  )
}

function toStringArrayLines(value: string): string[] {
  return value.split('\n').map((s) => s.trim()).filter((s) => s.length > 0)
}
