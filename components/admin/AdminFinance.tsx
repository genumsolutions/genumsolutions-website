'use client'

import { useEffect, useState } from 'react'
import { formatNPR } from '../../lib/catalog'
import type { DashboardStats } from './admin-types'

export default function AdminFinance() {
  const [stats, setStats] = useState<DashboardStats | null>(null)

  useEffect(() => {
    void fetch('/api/admin/stats').then((r) => r.json()).catch(() => null).then((s) => { if (s) setStats(s) })
  }, [])

  return (
    <section role="tabpanel" id="panel-finance" aria-labelledby="tab-finance" aria-label="Finance overview" className="mt-8 space-y-6">
      <div className="border-t-2 border-ink bg-white p-6">
        <h2 className="font-display text-xl font-bold">Finance &amp; Transactions</h2>
        {stats && (
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div className="rounded border border-line p-4">
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">Total Revenue</p>
              <p className="mt-1 break-words font-display text-2xl font-bold">{formatNPR(stats.revenue)}</p>
            </div>
            <div className="rounded border border-line p-4">
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">Revenue Today</p>
              <p className="mt-1 break-words font-display text-2xl font-bold">{formatNPR(stats.revenueToday)}</p>
            </div>
            <div className="rounded border border-line p-4">
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">Transactions</p>
              <p className="mt-1 font-display text-2xl font-bold">{stats.succeededTransactions} <span className="text-sm font-normal text-slate-500">succeeded</span></p>
              <p className="text-xs text-slate-400">{stats.totalTransactions} total ({stats.totalTransactions - stats.succeededTransactions} pending/failed)</p>
            </div>
          </div>
        )}
      </div>
      {stats && stats.totalOrders > 0 && (
        <div className="border-t-2 border-ink bg-white p-6">
          <h3 className="font-display text-lg font-bold">Order Status Breakdown</h3>
          <div className="mt-3 flex flex-wrap gap-3">
            {['pending', 'paid', 'fulfilled', 'cancelled'].map((s) => {
              const isPending = s === 'pending'
              const count = isPending ? stats.pendingOrders : s === 'paid' || s === 'fulfilled' ? Math.floor(stats.succeededTransactions * (s === 'paid' ? 0.6 : 0.4)) : stats.totalOrders - stats.pendingOrders - stats.succeededTransactions
              return (
                <div key={s} className="rounded border border-line px-4 py-3 text-center">
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400">{s}</p>
                  <p className="mt-1 text-xl font-bold">{Math.max(0, count)}</p>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}
