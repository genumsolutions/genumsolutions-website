'use client'

import { FormEvent, useEffect, useState } from 'react'
import { inputClass } from '../../lib/styles'
import type { Service } from './admin-types'
import { emptyService } from './admin-types'
import { focusEditor } from './admin-helpers'

type Props = { setMessage: (msg: string) => void }

export default function AdminServices({ setMessage }: Props) {
  const [services, setServices] = useState<Service[]>([])
  const [loaded, setLoaded] = useState(false)
  const [service, setService] = useState<Service>(emptyService)
  const [previewService, setPreviewService] = useState<Service | null>(null)
  const [category, setCategory] = useState('All')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void fetch('/api/admin/services').then((r) => r.json()).then((d) => setServices(d.services ?? [])).catch(() => undefined).finally(() => setLoaded(true))
  }, [])

  const categories = Array.from(new Set(services.map((s) => s.category).filter(Boolean)))
  const filteredServices = services.filter((s) => category === 'All' || s.category === category)

  function updateService(key: keyof Service, value: string | number | boolean) {
    setService((current) => ({ ...current, [key]: value }))
  }

  async function saveServiceItem(event?: FormEvent) {
    event?.preventDefault()
    if (!service.id || !service.name) { setMessage('Service needs at least an id and name.'); return }
    setBusy(true)
    const payload = { ...service, id: service.id.trim().toLowerCase().replace(/\s+/g, '-') }
    const response = await fetch('/api/admin/services', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) { setMessage(result.error || 'Could not save service.'); setBusy(false); return }
    setServices((current) => [...current.filter((s) => s.id !== payload.id), payload].sort((a, b) => a.sortOrder - b.sortOrder))
    setService(emptyService)
    setMessage('Service saved.')
    setBusy(false)
  }

  async function removeService(id: string) {
    if (!window.confirm(`Delete service ${id}?`)) return
    const response = await fetch(`/api/admin/services?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    if (response.ok) { setServices((current) => current.filter((s) => s.id !== id)); setMessage('Service deleted.') }
  }

  async function toggleServiceVisibility(item: Service) {
    const payload = { ...item, active: !item.active }
    const response = await fetch('/api/admin/services', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    if (response.ok) { setServices((current) => current.map((s) => s.id === item.id ? payload : s)); setMessage(item.active ? 'Service hidden.' : 'Service shown.') }
  }

  return (
    <>
      <div role="tabpanel" id="panel-services" aria-labelledby="tab-services" className="mt-8 grid min-w-0 gap-8 xl:grid-cols-[1fr_1.3fr]">
      <section aria-label="Service list" className="min-w-0 space-y-6">
        <div className="min-w-0 border-t-2 border-ink bg-white p-6">
          <h2 className="font-display text-xl font-bold">Services ({filteredServices.length})</h2>
          {!loaded ? <p className="text-sm text-slate-500" role="status">Loading…</p> : (
            <>
              {categories.length > 0 && (
                <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category filter" className={`mt-3 w-full sm:w-48 ${inputClass}`}>
                  <option value="All">All categories</option>
                  {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              )}
              <div className="mt-3 divide-y divide-line">
                {filteredServices.map((s) => (
                <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <div className="min-w-0 flex-1">
                    <span className="block line-clamp-2 text-sm"><strong>{s.name}</strong> <span className="text-slate-400">{s.priceLabel}</span></span>
                    {!s.active && <span className="ml-2 text-[10px] font-black uppercase text-red-500">inactive</span>}
                  </div>
                  <span className="flex shrink-0 flex-wrap gap-2">
                    <button onClick={() => { setService(s); focusEditor('service-editor') }} className="text-xs font-bold text-navy underline">Edit</button>
                    <button onClick={() => setPreviewService(s)} className="text-xs font-bold text-slate-500 underline">Preview</button>
                    <button onClick={() => void toggleServiceVisibility(s)} className="text-xs font-bold text-ink underline">{s.active ? 'Hide' : 'Show'}</button>
                    <button onClick={() => removeService(s.id)} className="text-xs font-bold text-red-600 underline">Delete</button>
                  </span>
                </div>
              ))}
              </div>
            </>
          )}
        </div>
      </section>
      <section id="service-editor" aria-label="Service editor" className="min-w-0">
        <form onSubmit={saveServiceItem} className="min-w-0 overflow-hidden border-t-2 border-ink bg-white p-6">
          <h2 className="font-display text-2xl font-bold">{services.some((s) => s.id === service.id) ? `Edit ${service.id}` : 'Add a new service'}</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="min-w-0 text-sm font-bold">Id<input value={service.id} onChange={(e) => updateService('id', e.target.value)} className={`mt-2 w-full ${inputClass}`} placeholder="e.g. website-design" /></label>
            <label className="min-w-0 text-sm font-bold">Name<input value={service.name} onChange={(e) => updateService('name', e.target.value)} className={`mt-2 w-full ${inputClass}`} /></label>
            <label className="min-w-0 text-sm font-bold">Category<select value={service.category} onChange={(e) => updateService('category', e.target.value)} className={`mt-2 w-full ${inputClass}`}>{Array.from(new Set([service.category, ...categories])).map((cat) => <option key={cat} value={cat}>{cat}</option>)}</select></label>
            <label className="min-w-0 text-sm font-bold">Price Label<input value={service.priceLabel} onChange={(e) => updateService('priceLabel', e.target.value)} className={`mt-2 w-full ${inputClass}`} placeholder="from NPR 35,000" /></label>
            <label className="min-w-0 text-sm font-bold">Tag / Badge<input value={service.tag} onChange={(e) => updateService('tag', e.target.value)} className={`mt-2 w-full ${inputClass}`} placeholder="Website, Fabrication, etc." /></label>
            <label className="min-w-0 text-sm font-bold">Sort Order<input type="number" value={service.sortOrder} onChange={(e) => updateService('sortOrder', Number(e.target.value))} className={`mt-2 w-full ${inputClass}`} /></label>
            <label className="min-w-0 text-sm font-bold sm:col-span-2">Description<textarea value={service.description} onChange={(e) => updateService('description', e.target.value)} rows={3} className={`mt-2 w-full ${inputClass}`} /></label>
            <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={service.active} onChange={(e) => updateService('active', e.target.checked)} className="h-4 w-4" /> Active (visible on site)</label>
          </div>
          <div className="mt-5 flex gap-3">
            <button type="submit" disabled={busy} className="bg-gold px-5 py-3 text-sm font-black text-ink transition hover:bg-gold-dark disabled:opacity-60">{busy ? 'Saving...' : 'Save service'}</button>
            {service.id && <button type="button" onClick={() => setService(emptyService)} className="border border-line px-5 py-3 text-sm font-black text-ink transition hover:border-navy">New service</button>}
          </div>
        </form>
      </section>
    </div>
    {previewService && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-5" role="dialog" aria-modal="true" aria-label="Service preview" onClick={() => setPreviewService(null)}>
        <article className="relative max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-2xl border border-line bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => setPreviewService(null)} className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-ink shadow-sm transition hover:bg-white" aria-label="Close preview">✕</button>
          <div className="p-6">
            <p className="truncate text-xs font-black uppercase tracking-widest text-navy">{previewService.tag || previewService.category}</p>
            <h2 className="mt-2 line-clamp-2 font-display text-xl font-bold leading-snug text-ink">{previewService.name}</h2>
            <p className="mt-2 flex-1 text-sm leading-6 text-muted">{previewService.description}</p>
            <div className="mt-5 flex items-center justify-between gap-3">
              <strong className="font-display text-lg text-ink">{previewService.priceLabel}</strong>
              <button onClick={() => setPreviewService(null)} className="rounded-full border border-line px-4 py-2 text-xs font-black text-ink transition hover:border-navy">Close</button>
            </div>
          </div>
        </article>
      </div>
    )}
  </>
  )
}
