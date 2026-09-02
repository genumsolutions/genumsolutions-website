'use client'

import { useEffect, useState } from 'react'
import { formatNPR } from '../../lib/catalog'
import type { DashboardStats, Analytics } from './admin-types'
import { Stat } from './admin-helpers'

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [analytics, setAnalytics] = useState<Analytics | null>(null)

  useEffect(() => {
    void Promise.all([
      fetch('/api/admin/stats').then((r) => r.json()).catch(() => null),
      fetch('/api/admin/analytics?days=30').then((r) => r.json()).catch(() => null),
    ]).then(([s, a]) => { if (s) setStats(s); if (a) setAnalytics(a) })
  }, [])

  return (
    <section role="tabpanel" aria-labelledby="tab-dashboard" aria-label="Dashboard overview" className="mt-8 space-y-8">
      <h2 className="font-display text-2xl font-bold text-ink">Dashboard</h2>
      {!stats ? <p className="text-sm text-slate-500" role="status">Loading stats…</p> : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Revenue" value={formatNPR(stats.revenue)} sub={`Today: ${formatNPR(stats.revenueToday)}`} />
            <Stat label="Orders" value={stats.totalOrders} sub={`${stats.pendingOrders} pending`} />
            <Stat label="Users" value={stats.totalUsers} sub={`${stats.newUsersToday} new today`} />
            <Stat label="Cart items" value={stats.totalCartItems} sub={`${stats.activeCarts} active carts`} />
            <Stat label="Products" value={stats.totalProducts} sub={stats.lowStockProducts > 0 ? `${stats.lowStockProducts} low stock` : 'Stock OK'} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Transactions" value={stats.totalTransactions} sub={`${stats.succeededTransactions} succeeded`} />
            <Stat label="Messages" value={stats.totalMessages} sub={`${stats.unreadMessages} unread`} />
            <Stat label="Page Views (30d)" value={analytics?.totalViews ?? '—'} sub={`Today: ${analytics?.todayViews ?? '—'}`} />
            <Stat label="Conversion Rate" value={stats.totalOrders > 0 && stats.totalUsers > 0 ? `${((stats.succeededTransactions / Math.max(1, stats.totalUsers)) * 100).toFixed(1)}%` : '—'} sub="Paid orders / users" />
          </div>
          {analytics && analytics.topPaths.length > 0 && (
            <div className="border-t-2 border-ink bg-white p-6">
              <h3 className="font-display text-lg font-bold">Top Pages (30 days)</h3>
              <ul className="mt-3 divide-y divide-line">
                {analytics.topPaths.slice(0, 10).map((pv) => (
                  <li key={pv.path} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="min-w-0 truncate font-mono text-xs text-slate-600">{pv.path}</span>
                    <span className="shrink-0 font-bold">{pv.count} views</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {analytics && analytics.viewsByDay.length > 0 && (
            <div className="border-t-2 border-ink bg-white p-6">
              <h3 className="font-display text-lg font-bold">Daily Traffic (30 days)</h3>
              <div className="mt-3 flex items-end gap-1" style={{ height: 120 }}>
                {analytics.viewsByDay.map((d) => {
                  const max = Math.max(...analytics.viewsByDay.map((x) => x.count), 1)
                  return (
                    <div key={d.date} className="flex-1 bg-navy" style={{ height: `${(d.count / max) * 100}%`, minHeight: 2 }} title={`${d.date}: ${d.count}`} />
                  )
                })}
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-slate-400">
                <span>{analytics.viewsByDay[0]?.date}</span>
                <span>{analytics.viewsByDay[analytics.viewsByDay.length - 1]?.date}</span>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  )
}
