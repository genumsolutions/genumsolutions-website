'use client'

/**
 * Reusable windowed row-editor engine for the three content-shaped admin
 * nouns (kind: 'training' | 'pilot' | 'curriculum'). One engine, three kinds.
 *
 * This is a pure extraction of the row editor previously inlined in
 * AdminSettings.tsx / AdminContent.tsx (Phase C, 2026-09-22): same fetch
 * contract (/api/admin/settings with action = kind), same payload nouns
 * (program / pilotLine / curriculum), same RBAC gate (canDelete → delete
 * hidden for staff, exactly the Phase B parity rule). Moving it behind a
 * `kind` prop lets both clients reuse one engine, never a re-implementation.
 */

import { FormEvent, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { inputClass } from '../../lib/styles'
import { Pager } from './admin-helpers'

type Kind = 'training' | 'pilot' | 'curriculum'

export type RowItem = {
  id: string
  title?: string
  ageBand?: string
  item?: string
  skills?: string[]
  sortOrder: number
  active: boolean
  [key: string]: unknown
}

const emptyRow: RowItem = { id: '', title: '', item: '', sortOrder: 0, active: true }

type Props = {
  kind: Kind
  rows: RowItem[]
  onChange: (rows: RowItem[]) => void
  caption?: string
  hint?: string
  canDelete: boolean
  setMessage: (msg: string) => void
}

const NOUN: Record<Kind, string> = {
  training: 'program',
  pilot: 'pilotLine',
  curriculum: 'curriculum',
}

const SINGULAR: Record<Kind, string> = {
  training: 'Training program',
  pilot: 'Pilot cost line',
  curriculum: 'Curriculum highlight',
}

const PAGE_SIZE = 8
let modalMount: HTMLElement | null = null

export default function AdminRows({ kind, rows, onChange, caption, hint, canDelete, setMessage }: Props) {
  const [busy, setBusy] = useState(false)
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<RowItem | null>(null)
  const [previewing, setPreviewing] = useState<RowItem | null>(null)
  const noun = NOUN[kind]
  const singular = SINGULAR[kind]

  useEffect(() => {
    setPage(1)
    setEditing(null)
    setPreviewing(null)
  }, [kind])

  async function refresh() {
    const response = await fetch('/api/admin/settings')
    const data = await response.json().catch(() => ({}))
    if (kind === 'training') onChange(data.trainingPrograms ?? [])
    else if (kind === 'pilot') onChange(data.pilotCostLines ?? [])
    else onChange(data.curriculumHighlights ?? [])
  }

  async function save(event?: FormEvent) {
    event?.preventDefault()
    const payload = { ...editing }
    if (kind === 'training' && !(payload.title ?? '').trim()) { setMessage('Program title is required.'); return }
    if ((kind === 'pilot' || kind === 'curriculum') && !((payload.id ?? '') as string).trim()) { setMessage(`A ${singular.toLowerCase()} needs an id.`); return }
    setBusy(true)
    const response = await fetch('/api/admin/settings', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: kind, [noun]: payload }),
    })
    const result = await response.json().catch(() => ({}))
    setBusy(false)
    if (!response.ok) { setMessage(result.error || `Could not save ${singular.toLowerCase()}.`); return }
    setMessage(`${singular} saved.`)
    await refresh()
    setEditing(null)
  }

  async function remove(id: string) {
    if (!window.confirm(`Delete ${singular.toLowerCase()} ${id}?`)) return
    const response = await fetch(`/api/admin/settings?action=${encodeURIComponent(kind)}&id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    if (response.ok) { onChange(rows.filter((r) => r.id !== id)); setMessage(`${singular} deleted.`) }
    else { const result = await response.json().catch(() => ({})); setMessage(result.error || 'Could not delete.') }
  }

  async function toggleVisibility(r: RowItem) {
    const payload = { ...r, active: r.active === false }
    setBusy(true)
    const response = await fetch('/api/admin/settings', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: kind, [noun]: payload }),
    })
    const result = await response.json().catch(() => ({}))
    setBusy(false)
    if (!response.ok) { setMessage(result.error || `Could not update ${singular.toLowerCase()}.`); return }
    onChange(rows.map((row) => row.id === r.id ? payload : row))
    setMessage(r.active === false ? `${singular} shown.` : `${singular} hidden.`)
  }

  const safe = (r: RowItem, fallback = '') => (r as { title?: string }).title?.trim() || r.id || fallback
  const filtered = rows
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const shown = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <section aria-label={`${singular}s`} className="min-w-0 border-t-2 border-ink bg-white p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-xl font-bold">{caption || `${singular}s`} ({rows.length})</h2>
          {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
        </div>
        <button
          onClick={() => setEditing({ ...emptyRow })}
          className="mt-2 bg-navy px-4 py-2 text-xs font-black text-white transition hover:bg-navy/90"
        >
          + New {singular.toLowerCase()}
        </button>
      </div>

      {editing && (
        <form onSubmit={save} className="mt-4 grid gap-3 rounded-lg border border-line bg-surface p-4">
          <h3 className="text-sm font-bold text-ink">{editing.id ? `Edit ${editing.id}` : `Add a ${singular.toLowerCase()}`}</h3>
          {kind === 'training' && (
            <>
              <label className="text-sm font-bold">Title<input value={editing.title ?? ''} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className={`mt-1 w-full ${inputClass}`} /></label>
              <label className="text-sm font-bold">Audience<input value={(editing as { audience?: string }).audience ?? ''} onChange={(e) => setEditing({ ...editing, audience: e.target.value })} className={`mt-1 w-full ${inputClass}`} placeholder="Students / Teachers / Makers" /></label>
              <label className="text-sm font-bold">Duration<input value={(editing as { duration?: string }).duration ?? ''} onChange={(e) => setEditing({ ...editing, duration: e.target.value })} className={`mt-1 w-full ${inputClass}`} placeholder="2 hours / 4 sessions" /></label>
              <label className="text-sm font-bold">Description<textarea value={(editing as { description?: string }).description ?? ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} rows={3} className={`mt-1 w-full ${inputClass}`} /></label>
              <label className="text-sm font-bold">Outcome<textarea value={(editing as { outcome?: string }).outcome ?? ''} onChange={(e) => setEditing({ ...editing, outcome: e.target.value })} rows={2} className={`mt-1 w-full ${inputClass}`} /></label>
            </>
          )}
          {kind === 'pilot' && (
            <>
              <label className="text-sm font-bold">Item<input value={editing.item ?? ''} onChange={(e) => setEditing({ ...editing, item: e.target.value })} className={`mt-1 w-full ${inputClass}`} /></label>
              <label className="text-sm font-bold">Cost<input value={(editing as { cost?: string }).cost ?? ''} onChange={(e) => setEditing({ ...editing, cost: e.target.value })} className={`mt-1 w-full ${inputClass}`} placeholder="NPR 25,000 / month" /></label>
              <label className="text-sm font-bold">Note<input value={(editing as { note?: string }).note ?? ''} onChange={(e) => setEditing({ ...editing, note: e.target.value })} className={`mt-1 w-full ${inputClass}`} /></label>
            </>
          )}
          {kind === 'curriculum' && (
            <>
              <label className="text-sm font-bold">Age band<input value={editing.ageBand ?? ''} onChange={(e) => setEditing({ ...editing, ageBand: e.target.value })} className={`mt-1 w-full ${inputClass}`} placeholder="Ages 8-11" /></label>
              <label className="text-sm font-bold">Skills / items (one per line)<textarea value={(editing.skills ?? []).join('\n')} onChange={(e) => setEditing({ ...editing, skills: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) })} rows={4} className={`mt-1 w-full ${inputClass}`} /></label>
            </>
          )}
          <label className="text-sm font-bold">Sort order<input type="number" value={editing.sortOrder ?? 0} onChange={(e) => setEditing({ ...editing, sortOrder: Number(e.target.value) })} className={`mt-1 w-full ${inputClass}`} /></label>
          <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={editing.active !== false} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} className="h-4 w-4" /> Active</label>
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="bg-gold px-4 py-2 text-xs font-black text-ink transition hover:bg-gold-dark disabled:opacity-60">{busy ? 'Saving...' : 'Save'}</button>
            <button type="button" onClick={() => setEditing(null)} className="border border-line px-4 py-2 text-xs font-black text-ink transition hover:border-navy">Cancel</button>
          </div>
        </form>
      )}

      <div className="mt-4 divide-y divide-line">
        {shown.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span className="min-w-0 flex-1">
              <span className="block text-sm"><strong>{safe(r)}</strong> {kind === 'curriculum' && r.ageBand && <span className="text-slate-400">({r.ageBand})</span>}</span>
            </span>
            <span className="flex shrink-0 gap-2">
              <button onClick={() => setPreviewing(r)} className="text-xs font-bold text-navy underline">Preview</button>
              <button onClick={() => setEditing({ ...r })} className="text-xs font-bold text-navy underline">Edit</button>
              <button onClick={() => void toggleVisibility(r)} disabled={busy} className="text-xs font-bold text-ink underline disabled:opacity-60">{r.active === false ? 'Show' : 'Hide'}</button>
              {canDelete && <button onClick={() => void remove(r.id)} className="text-xs font-bold text-red-600 underline">Delete</button>}
            </span>
          </div>
        ))}
        {shown.length === 0 && <p className="py-3 text-sm text-slate-500">No {singular.toLowerCase()}s yet.</p>}
      </div>

      {totalPages > 1 && (
        <Pager page={page} totalPages={totalPages} onPage={setPage} />
      )}

      {previewing && typeof document !== 'undefined' && !modalMount && (modalMount = document.body) && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-5" role="dialog" aria-modal="true" aria-label={`${singular} preview`} onClick={() => setPreviewing(null)}>
          <article className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-line bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <p className="truncate text-xs font-black uppercase tracking-widest text-navy">{kind === 'curriculum' ? previewing.ageBand || 'Curriculum' : kind === 'pilot' ? 'Pilot cost' : 'Training'}</p>
            <h2 className="mt-2 font-display text-xl font-bold text-ink">{safe(previewing)}</h2>
            {kind === 'curriculum' && previewing.skills?.length ? (
              <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-slate-700">
                {(previewing.skills as string[]).map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            ) : (
              <p className="mt-4 text-sm leading-6 text-slate-600">{(previewing as { description?: string }).description || (previewing as { note?: string }).note || (previewing.item ?? '')}</p>
            )}
            <div className="mt-5 flex items-center justify-between gap-3">
              <strong className="font-display text-lg text-ink">{kind === 'pilot' ? (previewing as { cost?: string }).cost : ''}</strong>
              <button onClick={() => setPreviewing(null)} className="rounded-full border border-line px-4 py-2 text-xs font-black text-ink transition hover:border-navy">Close</button>
            </div>
          </article>
        </div>,
        modalMount,
      )}
    </section>
  )
}
