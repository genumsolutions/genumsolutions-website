"use client";

import { useEffect, useState } from "react";
import type { DashboardStats, Analytics } from "./admin-types";
import { EmptyState, LoadingRow, PanelCard, Stat, panelCard, panelTitle } from "./admin-helpers";

// 2026-11-13 (site polish batch 4): the Dashboard used to publish Revenue,
// Revenue today, Transactions and Conversion rate — the same four numbers
// AdminFinance renders in the same admin, so the console disagreed with itself
// the moment one fetch landed before the other. Money now has ONE home
// (Orders → Finance) and the Dashboard answers operations: orders, stock,
// accounts, messages and traffic.
export default function AdminDashboard({ onOpenOrders }: { onOpenOrders: () => void }) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [statsFailed, setStatsFailed] = useState(false);

  useEffect(() => {
    void Promise.all([
      fetch("/api/admin/stats")
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error("stats"))))
        .catch(() => null),
      fetch("/api/admin/analytics?days=30")
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error("analytics"))))
        .catch(() => null),
    ]).then(([s, a]) => {
      if (s) setStats(s);
      else setStatsFailed(true);
      if (a) setAnalytics(a);
    });
  }, []);

  return (
    <section aria-label="Dashboard overview" className="mt-4 space-y-4">
      <h2 className={panelTitle}>Dashboard</h2>
      {!stats && !statsFailed && <LoadingRow />}
      {!stats && statsFailed && (
        <EmptyState>
          The dashboard numbers could not be loaded. Reload the page to try again — the panels below
          still work.
        </EmptyState>
      )}
      {stats && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Orders" value={stats.totalOrders} sub={`${stats.pendingOrders} pending`} />
            <Stat label="Users" value={stats.totalUsers} sub={`${stats.newUsersToday} new today`} />
            <Stat
              label="Cart items"
              value={stats.totalCartItems}
              sub={`${stats.activeCarts} active carts`}
            />
            <Stat
              label="Products"
              value={stats.totalProducts}
              sub={
                stats.lowStockProducts > 0 || (stats.outOfStockProducts ?? 0) > 0
                  ? `${stats.lowStockProducts} low stock · ${stats.outOfStockProducts ?? 0} out of stock`
                  : "Stock OK"
              }
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Messages"
              value={stats.totalMessages}
              sub={`${stats.unreadMessages} unread`}
            />
            <Stat
              label="Page Views (30d)"
              value={analytics?.totalViews ?? "—"}
              sub={`Today: ${analytics?.todayViews ?? "—"}`}
            />
          </div>

          <PanelCard className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-muted">Money</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Revenue, transactions and the order status split live in one place — Orders, then
                Finance.
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenOrders}
              className="min-h-[44px] shrink-0 rounded-full border border-navy px-4 py-2 text-xs font-black text-navy transition hover:bg-mist"
            >
              Open Orders
            </button>
          </PanelCard>

          {analytics && analytics.topPaths.length > 0 && (
            <div className={panelCard}>
              <h3 className="font-display text-lg font-bold">Top Pages (30 days)</h3>
              <ul className="mt-3 divide-y divide-line">
                {analytics.topPaths.slice(0, 10).map((pv) => (
                  <li
                    key={pv.path}
                    className="flex items-center justify-between gap-3 py-2 text-sm"
                  >
                    <span className="min-w-0 break-all font-mono text-xs text-slate-600">
                      {pv.path}
                    </span>
                    <span className="shrink-0 font-bold">{pv.count} views</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {analytics && analytics.viewsByDay.length > 0 && (
            <div className={panelCard}>
              <h3 className="font-display text-lg font-bold">Daily Traffic (30 days)</h3>
              <div className="mt-3 flex items-end gap-1" style={{ height: 120 }}>
                {analytics.viewsByDay.map((d) => {
                  const max = Math.max(...analytics.viewsByDay.map((x) => x.count), 1);
                  return (
                    <div
                      key={d.date}
                      className="flex-1 bg-navy"
                      style={{ height: `${(d.count / max) * 100}%`, minHeight: 2 }}
                      title={`${d.date}: ${d.count}`}
                    />
                  );
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
  );
}
