'use client'

import { useEffect, useState } from 'react'
import { inputClass } from '../../lib/styles'

type Props = { setMessage: (msg: string) => void }

export default function AdminContent({ setMessage }: Props) {
  const [loaded, setLoaded] = useState(false)
  const [homeTitle, setHomeTitle] = useState('')
  const [homeBody, setHomeBody] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void fetch('/api/admin/content')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        setHomeTitle(data.homeTitle || '')
        setHomeBody(data.homeBody || '')
      })
      .catch(() => setMessage('Could not load site content.'))
      .finally(() => setLoaded(true))
  }, [setMessage])

  async function save(event?: React.FormEvent) {
    event?.preventDefault()
    if (!homeTitle.trim() || !homeBody.trim()) {
      setMessage('Homepage title and body are required.')
      return
    }
    setBusy(true)
    const response = await fetch('/api/admin/content', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ homeTitle: homeTitle.trim(), homeBody: homeBody.trim() }),
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) { setMessage(result.error || 'Could not save content.'); setBusy(false); return }
    setMessage('Site content saved.')
    setBusy(false)
  }

  return (
    <div role="tabpanel" id="panel-content" aria-labelledby="tab-content" className="mt-8">
      <div className="min-w-0 border-t-2 border-ink bg-white p-6">
        <h2 className="font-display text-2xl font-bold">Homepage content</h2>
        {!loaded ? (
          <p className="mt-3 text-sm text-slate-500" role="status">Loading…</p>
        ) : (
          <form onSubmit={save} className="mt-5 grid gap-4">
            <label className="min-w-0 text-sm font-bold">
              Homepage title
              <textarea value={homeTitle} onChange={(e) => setHomeTitle(e.target.value)} rows={2} className={`mt-2 w-full ${inputClass}`} />
            </label>
            <label className="min-w-0 text-sm font-bold">
              Homepage body
              <textarea value={homeBody} onChange={(e) => setHomeBody(e.target.value)} rows={8} className={`mt-2 w-full ${inputClass}`} />
            </label>
            <div className="flex gap-3">
              <button type="submit" disabled={busy} className="bg-gold px-5 py-3 text-sm font-black text-ink transition hover:bg-gold-dark disabled:opacity-60">
                {busy ? 'Saving...' : 'Save content'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
