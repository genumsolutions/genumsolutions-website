'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'

export function Pager({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (page: number) => void }) {
  if (totalPages <= 1) return null
  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-between text-sm font-bold">
      <button onClick={() => onPage(page - 1)} disabled={page <= 1} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 transition hover:border-navy hover:text-navy disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft size={14} aria-hidden="true" /> Prev</button>
      <span aria-live="polite" className="text-slate-500">Page {page} of {totalPages}</span>
      <button onClick={() => onPage(page + 1)} disabled={page >= totalPages} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 transition hover:border-navy hover:text-navy disabled:cursor-not-allowed disabled:opacity-40">Next <ChevronRight size={14} aria-hidden="true" /></button>
    </nav>
  )
}

export function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="border-t-2 border-ink bg-white p-5">
      <p className="text-xs font-black uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-2 break-words font-display text-3xl font-bold text-ink">{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  )
}

export function formatTimestamp(ts: string) {
  try { return new Date(ts).toLocaleString() } catch { return ts }
}

export function focusEditor(id: string) {
  window.requestAnimationFrame(() => {
    const editor = document.getElementById(id)
    editor?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    editor?.querySelector<HTMLInputElement>('input, textarea, select')?.focus()
  })
}
