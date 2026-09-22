'use client'

import { FormEvent, useEffect, useState } from 'react'
import { inputClass } from '../../lib/styles'

type Props = { setMessage: (msg: string) => void; canDelete: boolean }

type CompanyInfo = {
  name: string; shortName: string; address: string; city: string; country: string;
  email: string; phone: string; pan: string; vatLabel: string; description: string
}

const emptyCompany: CompanyInfo = {
  name: '', shortName: '', address: '', city: '', country: '',
  email: '', phone: '', pan: '', vatLabel: '', description: '',
}

export default function AdminSettings({ setMessage, canDelete: _canDelete }: Props) {
  const [loaded, setLoaded] = useState(false)
  const [company, setCompany] = useState<CompanyInfo>(emptyCompany)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void fetch('/api/admin/settings')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => setCompany({ ...emptyCompany, ...(data.company ?? {}) }))
      .catch(() => setMessage('Could not load company information.'))
      .finally(() => setLoaded(true))
  }, [setMessage])

  async function saveCompany(event?: FormEvent) {
    event?.preventDefault()
    if (!company.name.trim() || !company.email.trim()) { setMessage('Company name and email are required.'); return }
    setBusy(true)
    const response = await fetch('/api/admin/settings', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'company', company: { ...company, name: company.name.trim(), email: company.email.trim() } }),
    })
    const result = await response.json().catch(() => ({}))
    setBusy(false)
    if (!response.ok) { setMessage(result.error || 'Could not save company information.'); return }
    setMessage('Company information saved.')
  }

  return (
    <div role="tabpanel" id="panel-settings" aria-labelledby="tab-settings" className="mt-8">
      <div className="min-w-0 border-t-2 border-ink bg-white p-6">
        <h2 className="font-display text-2xl font-bold">Company information</h2>
        {!loaded ? (
          <p className="mt-3 text-sm text-slate-500" role="status">Loading…</p>
        ) : (
          <form onSubmit={saveCompany} className="mt-5 grid gap-4">
            <label className="min-w-0 text-sm font-bold">Name<input value={company.name} onChange={(e) => setCompany({ ...company, name: e.target.value })} className={`mt-2 w-full ${inputClass}`} /></label>
            <label className="min-w-0 text-sm font-bold">Short name<input value={company.shortName} onChange={(e) => setCompany({ ...company, shortName: e.target.value })} className={`mt-2 w-full ${inputClass}`} /></label>
            <label className="min-w-0 text-sm font-bold">Address<textarea value={company.address} onChange={(e) => setCompany({ ...company, address: e.target.value })} rows={2} className={`mt-2 w-full ${inputClass}`} /></label>
            <label className="min-w-0 text-sm font-bold">City<input value={company.city} onChange={(e) => setCompany({ ...company, city: e.target.value })} className={`mt-2 w-full ${inputClass}`} /></label>
            <label className="min-w-0 text-sm font-bold">Country<input value={company.country} onChange={(e) => setCompany({ ...company, country: e.target.value })} className={`mt-2 w-full ${inputClass}`} /></label>
            <label className="min-w-0 text-sm font-bold">Email<input type="email" value={company.email} onChange={(e) => setCompany({ ...company, email: e.target.value })} className={`mt-2 w-full ${inputClass}`} /></label>
            <label className="min-w-0 text-sm font-bold">Phone<input value={company.phone} onChange={(e) => setCompany({ ...company, phone: e.target.value })} className={`mt-2 w-full ${inputClass}`} /></label>
            <label className="min-w-0 text-sm font-bold">PAN<input value={company.pan} onChange={(e) => setCompany({ ...company, pan: e.target.value })} className={`mt-2 w-full ${inputClass}`} /></label>
            <label className="min-w-0 text-sm font-bold">VAT label<input value={company.vatLabel} onChange={(e) => setCompany({ ...company, vatLabel: e.target.value })} className={`mt-2 w-full ${inputClass}`} /></label>
            <label className="min-w-0 text-sm font-bold">Description<textarea value={company.description} onChange={(e) => setCompany({ ...company, description: e.target.value })} rows={3} className={`mt-2 w-full ${inputClass}`} /></label>
            <div className="flex gap-3">
              <button type="submit" disabled={busy} className="bg-navy px-5 py-3 text-sm font-black text-white transition hover:bg-navy/90 disabled:opacity-60">
                {busy ? 'Saving...' : 'Save company'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
