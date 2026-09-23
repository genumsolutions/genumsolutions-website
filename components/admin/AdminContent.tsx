'use client'

import { useEffect, useState } from 'react'
import { inputClass } from '../../lib/styles'
import AdminRows from './AdminRows'
import type { RowItem } from './AdminRows'
import { LoadingRow, PanelCard, SaveBar, editorCardTitle } from './admin-helpers'

type Props = {
  setMessage: (msg: string) => void
  canDelete: boolean
}

export default function AdminContent({ setMessage, canDelete }: Props) {
  const [loaded, setLoaded] = useState(false)
  const [homeTitle, setHomeTitle] = useState('')
  const [homeBody, setHomeBody] = useState('')
  const [busy, setBusy] = useState(false)

  const [programs, setPrograms] = useState<RowItem[]>([])
  const [pilots, setPilots] = useState<RowItem[]>([])
  const [curricula, setCurricula] = useState<RowItem[]>([])

  useEffect(() => {
    void Promise.all([
      fetch('/api/admin/content').then((r) => (r.ok ? r.json() : Promise.reject())),
      fetch('/api/admin/settings').then((r) => (r.ok ? r.json() : Promise.reject())),
    ])
      .then(([content, settings]) => {
        setHomeTitle(content.homeTitle || '')
        setHomeBody(content.homeBody || '')
        setPrograms(settings.trainingPrograms ?? [])
        setPilots(settings.pilotCostLines ?? [])
        setCurricula(settings.curriculumHighlights ?? [])
      })
      .catch(() => setMessage('Could not load site content.'))
      .finally(() => setLoaded(true))
  }, [setMessage])

  async function save(event?: React.FormEvent) {
    event?.preventDefault()
    if (!homeTitle.trim() || !homeBody.trim()) { setMessage('Homepage title and body are required.'); return }
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
      <PanelCard>
        <h2 className={editorCardTitle}>Homepage content</h2>
        {!loaded ? (
          <LoadingRow className="mt-3" />
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
            <SaveBar>
              <button type="submit" disabled={busy} className="bg-gold px-5 py-3 text-sm font-black text-ink transition hover:bg-gold-dark disabled:opacity-60">
                {busy ? 'Saving...' : 'Save content'}
              </button>
            </SaveBar>
          </form>
        )}
      </PanelCard>

      <div className="mt-6 grid gap-6">
        <AdminRows
          kind="training"
          rows={programs}
          onChange={setPrograms}
          caption="Training programs"
          hint="Windo training shows on the app home + website pages."
          canDelete={canDelete}
          setMessage={setMessage}
        />
        <AdminRows
          kind="pilot"
          rows={pilots}
          onChange={setPilots}
          caption="Pilot cost lines"
          hint="Running costs shown on the app home screen."
          canDelete={canDelete}
          setMessage={setMessage}
        />
        <AdminRows
          kind="curriculum"
          rows={curricula}
          onChange={setCurricula}
          caption="Curriculum highlights"
          hint="Age-band skills for the app home screen."
          canDelete={canDelete}
          setMessage={setMessage}
        />
      </div>
    </div>
  )
}
