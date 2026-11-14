"use client";

import { useEffect, useState } from "react";
import { formatNPR } from "../../lib/catalog";
import type { DashboardStats } from "./admin-types";
import { EmptyState, LoadingRow, PanelCard, Stat, panelTitle } from "./admin-helpers";

// 2026-11-13 (site polish batch 4): this is now the ONLY place the console
// shows money. It used to duplicate the Dashboard's revenue/transaction tiles
// (and the Dashboard duplicated these), so the two tabs could disagree while
// their separate fetches were in flight. Conversion moved here with them.
export default function AdminFinance() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    void fetch("/api/admin/stats")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("stats"))))
      .catch(() => null)
      .then((s) => {
        if (s) setStats(s);
        else setFailed(true);
      });
  }, []);

  const conversionRate =
    stats && stats.totalOrders > 0 && stats.totalUsers > 0
      ? `${((stats.succeededTransactions / Math.max(1, stats.totalUsers)) * 100).toFixed(1)}%`
      : "—";

  return (
    <section aria-label="Finance overview" className="mt-4 space-y-4">
      <PanelCard>
        <h2 className={panelTitle}>Finance &amp; Transactions</h2>
        {!stats && !failed && <LoadingRow className="mt-3" />}
        {!stats && failed && (
          <EmptyState className="mt-3">
            Finance figures could not be loaded. Reload the page to try again.
          </EmptyState>
        )}
        {stats && (
          <>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Total revenue" value={formatNPR(stats.revenue)} />
              <Stat label="Revenue today" value={formatNPR(stats.revenueToday)} />
              <Stat
                label="Transactions"
                value={stats.succeededTransactions}
                sub={`${stats.totalTransactions} total · ${stats.totalTransactions - stats.succeededTransactions} pending/failed`}
              />
              <Stat label="Conversion" value={conversionRate} sub="Paid orders / users" />
            </div>
            {stats.totalTransactions === 0 && (
              <EmptyState className="mt-4">
                No payments recorded yet. Cash-on-delivery and gateway orders appear here as soon as
                the first one is placed.
              </EmptyState>
            )}
          </>
        )}
      </PanelCard>
      <PanelCard>
        <h3 className="font-display text-lg font-bold">Order Status Breakdown</h3>
        {!stats ? (
          <LoadingRow className="mt-3" />
        ) : stats.totalOrders === 0 ? (
          <EmptyState className="mt-3">
            No orders yet — the pending / paid / fulfilled split appears with the first order.
          </EmptyState>
        ) : (
          <div className="mt-3 flex flex-wrap gap-3">
            {[
              { key: "pending", label: "Pending", count: stats.pendingOrders },
              { key: "paid", label: "Paid", count: stats.paidOrders },
              { key: "fulfilled", label: "Fulfilled", count: stats.fulfilledOrders },
              { key: "cancelled", label: "Cancelled", count: stats.cancelledOrders },
            ].map(({ key, label, count }) => {
              return (
                <div key={key} className="rounded-lg border border-line px-3 py-2 text-center">
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                    {label}
                  </p>
                  <p className="mt-1 text-xl font-bold">{Math.max(0, count)}</p>
                </div>
              );
            })}
          </div>
        )}
      </PanelCard>
    </section>
  );
}
