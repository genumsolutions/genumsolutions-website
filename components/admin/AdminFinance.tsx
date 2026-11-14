"use client";

import { useEffect, useState } from "react";
import { formatNPR } from "../../lib/catalog";
import type { DashboardStats } from "./admin-types";
import { EmptyState, LoadingRow, PanelCard, Stat, panelId, panelTitle } from "./admin-helpers";
import { tabBase, tabActive, tabInactive } from "../../lib/styles";

// U-UI2 (2026-11-14): sub-tabs for Finance tab — mirroring the 3D Products pattern.
// Only one sub-tab is visible at a time, sub-tabs are sticky while scrolling.
const FINANCE_SUBTABS = ["Overview", "Transactions", "Payments"] as const;
type FinanceSubTab = (typeof FINANCE_SUBTABS)[number];

export default function AdminFinance() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [failed, setFailed] = useState(false);
  const [subTab, setSubTab] = useState<FinanceSubTab>("Overview");

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
      {/* U-UI2 sub-tabs strip - sticky, one at a time */}
      <div className="sticky top-0 z-20 -mx-5 border-b border-line bg-white/95 px-5 backdrop-blur lg:-mx-8 lg:px-8">
        <div
          role="tablist"
          aria-label="Finance sub-tabs"
          className="flex items-center gap-2 overflow-x-auto pb-0.5 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {FINANCE_SUBTABS.map((sub: FinanceSubTab, _: number) => (
            <button
              key={sub}
              role="tab"
              aria-selected={subTab === sub}
              aria-controls={`finance-subpanel-${panelId(sub)}`}
              tabIndex={subTab === sub ? 0 : -1}
              onClick={() => setSubTab(sub)}
              className={`${tabBase} text-[10px] ${subTab === sub ? tabActive : tabInactive}`}
            >
              {sub}
            </button>
          ))}
        </div>
      </div>

      {subTab === "Overview" && (
        <PanelCard>
          <h2 className={panelTitle}>Finance & Transactions</h2>
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
                  No payments recorded yet. Cash-on-delivery and gateway orders appear here as soon
                  as the first one is placed.
                </EmptyState>
              )}
            </>
          )}
        </PanelCard>
      )}

      {subTab === "Transactions" && (
        <PanelCard>
          <h2 className={panelTitle}>Transactions</h2>
          {/* Transaction listing would go here */}
          <p className="text-sm text-slate-500">Transactions sub-tab content</p>
        </PanelCard>
      )}

      {subTab === "Payments" && (
        <PanelCard>
          <h2 className={panelTitle}>Payments</h2>
          {/* Payment details would go here */}
          <p className="text-sm text-slate-500">Payments sub-tab content</p>
        </PanelCard>
      )}
    </section>
  );
}
