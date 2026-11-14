"use client";

import { useEffect, useState } from "react";
import { formatNPR } from "../../lib/catalog";
import type { DashboardStats } from "./admin-types";
import { EmptyState, LoadingRow, PanelCard, Stat, panelTitle } from "./admin-helpers";
import { tabBase, tabActive, tabInactive } from "../lib/styles";

// U-UI2 (2026-11-14): sub-tabs for Finance tab — mirroring the 3D Products pattern.
// Only one sub-tab is visible at a time, sub-tabs are sticky while scrolling.
const FINANCE_SUBTABS = ["Overview", "Transactions", "Payments"] as const;
type FinanceSubTab = (typeof FINANCE_SUBTABS)[number];

export default function AdminFinance() {
  const [subTab, setSubTab] = useState<FinanceSubTab>("Overview");

  // U-UI2 sub-tabs strip - sticky, one at a time
  const renderSubTabStrip = () => (
    <div className="sticky top-0 z-20 -mx-5 border-b border-line bg-white/95 px-5 backdrop-blur lg:-mx-8 lg:px-8">
      <div
        role="tablist"
        aria-label="Finance sub-tabs"
        className="flex items-center gap-2 overflow-x-auto pb-0.5 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {FINANCE_SUBTABS.map((sub: FinanceSubTab, i: number) => (
          <button
            key={sub}
            role="tab"
            aria-selected={subTab === sub}
            aria-controls={`finance-subpanel-${sub}`}
            tabIndex={subTab === sub ? 0 : -1}
            onClick={() => setSubTab(sub)}
            className={`${tabBase} text-[10px] ${subTab === sub ? tabActive : tabInactive}`}
          >
            {sub}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <>{renderSubTabStrip()}

      {subTab === "Overview" && (
        <><PanelCard>
          <h2 className={panelTitle}>Overview</h2>
          <p className="text-sm text-slate-500">Finance overview sub-tab content</p>
        </PanelCard>
      )}

      {subTab === "Transactions" && (
        <><PanelCard>
          <h2 className={panelTitle}>Transactions</h2>
          <p className="text-sm text-slate-500">Finance transactions sub-tab content</p>
        </PanelCard>
      )}

      {subTab === "Payments" && (
        <><PanelCard>
          <h2 className={panelTitle}>Payments</h2>
          <p className="text-sm text-slate-500">Finance payments sub-tab content</p>
        </PanelCard>
      )}
    </>
  );
}