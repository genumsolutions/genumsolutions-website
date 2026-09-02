'use client'

import { useEffect, useState } from 'react'
import type { ActivityEntry } from './admin-types'
import { PAGE_SIZE } from './admin-types'
import { Pager, formatTimestamp } from './admin-helpers'

export default function AdminActivity() {
  const [activities, setActivities] = useState<ActivityEntry[]>([])
  const [loaded, setLoaded] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  useEffect(() => { void loadActivity(1) }, [])

  async function loadActivity(p: number) {
    setLoaded(false)
    try {
      const response = await fetch(`/api/admin/activity?page=${p}&limit=${PAGE_SIZE}`)
      if (response.ok) {
        const data = await response.json()
        setActivities(data.entries ?? [])
        setTotal(data.total ?? 0)
        setPage(data.page ?? 1)
        setTotalPages(data.totalPages ?? 1)
      }
    } finally { setLoaded(true) }
  }

  return (
    <section role="tabpanel" id="panel-activity" aria-labelledby="tab-activity" aria-label="Activity log" className="mt-8 space-y-4">
      <div className="border-t-2 border-ink bg-white p-6">
        <h2 className="font-display text-xl font-bold">Activity Log</h2>
      </div>
      {!loaded ? <p className="text-sm text-slate-500" role="status">Loading…</p> : activities.length === 0 ? <p className="text-sm text-slate-500">No activity recorded yet.</p> : (
        <>
          <ul className="space-y-2">
            {activities.map((entry) => (
              <li key={entry.id} className="flex items-start gap-3 border border-line bg-white px-4 py-3">
                <span className={`mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full ${entry.action.includes('deleted') ? 'bg-red-500' : entry.action.includes('saved') ? 'bg-emerald-500' : entry.action.includes('status') ? 'bg-amber-500' : 'bg-navy'}`} />
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm"><span className="font-bold">{entry.action}</span> <span className="text-slate-400">{entry.entityType}{entry.entityId ? ` / ${entry.entityId}` : ''}</span></p>
                  {Object.keys(entry.details).length > 0 && <p className="mt-0.5 break-words text-xs text-slate-500">{JSON.stringify(entry.details)}</p>}
                </div>
                <span className="shrink-0 text-xs text-slate-400">{formatTimestamp(entry.createdAt)}</span>
              </li>
            ))}
          </ul>
          <Pager page={page} totalPages={totalPages} onPage={(p) => void loadActivity(p)} />
          <p className="text-xs text-slate-400">{total} total event{total === 1 ? '' : 's'}</p>
        </>
      )}
    </section>
  )
}
