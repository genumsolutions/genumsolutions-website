'use client'

import { useEffect, useState } from 'react'
import type { Message } from './admin-types'
import { PAGE_SIZE } from './admin-types'
import { Pager, formatTimestamp } from './admin-helpers'

type Props = { setMessage: (msg: string) => void }

export default function AdminMessages({ setMessage: _setMessage }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loaded, setLoaded] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [filter, setFilter] = useState('')

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void loadMessages(1) }, [])

  async function loadMessages(p: number) {
    setLoaded(false)
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(PAGE_SIZE) })
      if (filter) params.set('status', filter)
      const response = await fetch(`/api/admin/messages?${params}`)
      if (response.ok) {
        const data = await response.json()
        setMessages(data.messages ?? [])
        setTotal(data.total ?? 0)
        setPage(data.page ?? 1)
        setTotalPages(data.totalPages ?? 1)
      }
    } finally { setLoaded(true) }
  }

  async function markReplied(id: string) {
    const response = await fetch('/api/admin/messages', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status: 'replied' }) })
    if (response.ok) setMessages((current) => current.map((m) => m.id === id ? { ...m, status: 'replied' } : m))
  }

  return (
    <section role="tabpanel" id="panel-messages" aria-labelledby="tab-messages" aria-label="Customer messages" className="mt-8 space-y-4">
      <div className="flex flex-col gap-3 border-t-2 border-ink bg-white p-6 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <h2 className="font-display text-xl font-bold">Messages</h2>
        <label className="ml-auto text-sm font-bold text-slate-500">Status
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="ml-2 border border-line px-3 py-2 text-sm font-bold">
            <option value="">All</option>
            <option value="new">New</option>
            <option value="replied">Replied</option>
          </select>
        </label>
        <button onClick={() => void loadMessages(1)} className="bg-navy px-4 py-2 text-xs font-black text-white transition hover:bg-navy-dark">Apply</button>
      </div>
      {!loaded ? <p className="text-sm text-slate-500" role="status">Loading…</p> : messages.length === 0 ? <p className="text-sm text-slate-500">No messages found.</p> : (
        <>
          <ul className="space-y-3">
            {messages.map((msg) => (
              <li key={msg.id} className={`border bg-white p-4 ${msg.status === 'new' ? 'border-l-4 border-l-navy border-line' : 'border-line'}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{msg.name} <span className="font-normal text-slate-500">· {msg.email}</span></p>
                    <p className="mt-1 text-xs text-slate-400">{formatTimestamp(msg.created_at)}</p>
                  </div>
                  {msg.status === 'new' && <button onClick={() => markReplied(msg.id)} className="border border-line px-3 py-1.5 text-xs font-bold text-navy transition hover:border-navy">Mark replied</button>}
                  {msg.status === 'replied' && <span className="text-[10px] font-black uppercase text-emerald-600">Replied</span>}
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{msg.message}</p>
              </li>
            ))}
          </ul>
          <Pager page={page} totalPages={totalPages} onPage={(p) => void loadMessages(p)} />
          <p className="text-xs text-slate-400">{total} total message{total === 1 ? '' : 's'}</p>
        </>
      )}
    </section>
  )
}
