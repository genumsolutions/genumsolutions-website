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
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void fetch('/api/admin/services').then((r) => r.json()).then((d) => setServices(d.services ?? [])).catch(() => undefined).finally(() => setLoaded(true))
  }, [])

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

  return (
    <div role="tabpanel" id="panel-services" aria-labelledby="tab-services" className="mt-8 grid min-w-0 gap-8 xl:grid-cols-[1fr_1.3fr]">
      <section aria-label="Service list" className="min-w-0 space-y-6">
        <div className="min-w-0 border-t-2 border-ink bg-white p-6">
          <h2 className="font-display text-xl font-bold">Services ({services.length})</h2>
          {!loaded ? <p className="text-sm text-slate-500" role="status">Loading…</p> : (
            <div className="mt-3 divide-y divide-line">
              {services.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <span className="block line-clamp-2 text-sm"><strong>{s.name}</strong> <span className="text-slate-400">{s.priceLabel}</span></span>
                    {!s.active && <span className="ml-2 text-[10px] font-black uppercase text-red-500">inactive</span>}
                  </div>
                  <span className="flex shrink-0 gap-2">
                    <button onClick={() => { setService(s); focusEditor('service-editor') }} className="text-xs font-bold text-navy underline">Edit</button>
                    <button onClick={() => removeService(s.id)} className="text-xs font-bold text-red-600 underline">Delete</button>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
      <section id="service-editor" aria-label="Service editor" className="min-w-0">
        <form onSubmit={saveServiceItem} className="min-w-0 overflow-hidden border-t-2 border-ink bg-white p-6">
          <h2 className="font-display text-2xl font-bold">{services.some((s) => s.id === service.id) ? `Edit ${service.id}` : 'Add a new service'}</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="min-w-0 text-sm font-bold">Id<input value={service.id} onChange={(e) => updateService('id', e.target.value)} className={`mt-2 w-full ${inputClass}`} placeholder="e.g. website-design" /></label>
            <label className="min-w-0 text-sm font-bold">Name<input value={service.name} onChange={(e) => updateService('name', e.target.value)} className={`mt-2 w-full ${inputClass}`} /></label>
            <label className="min-w-0 text-sm font-bold">Category<input value={service.category} onChange={(e) => updateService('category', e.target.value)} className={`mt-2 w-full ${inputClass}`} /></label>
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
  )
}
