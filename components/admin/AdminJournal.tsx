"use client";

import { useEffect, useState } from "react";
import type { JournalItem } from "./admin-types";
import { emptyJournal } from "./admin-types";
import {
  EmptyState,
  LoadingRow,
  PanelCard,
  panelListSection,
  panelTitle,
} from "./admin-helpers";
import { tabBase, tabActive, tabInactive } from "../../lib/styles";

// U-UI2 (2026-11-14): sub-tabs for Journal tab — mirroring the 3D Products pattern.
// Only one sub-tab is visible at a time, sub-tabs are sticky while scrolling.
const JOURNAL_SUBTABS = ["Posts", "Categories", "Tags"] as const;
type JournalSubTab = (typeof JOURNAL_SUBTABS)[number];

export default function AdminJournal({ setMessage, canDelete }: { setMessage: (msg: string) => void; canDelete: boolean }) {
  const [subTab, setSubTab] = useState<JournalSubTab>("Posts");

  // U-UI2 sub-tabs strip - sticky, one at a time
  const renderSubTabStrip = () => (
    <div className="sticky top-0 z-20 -mx-5 border-b border-line bg-white/95 px-5 backdrop-blur lg:-mx-8 lg:px-8">
      <div
        role="tablist"
        aria-label="Journal sub-tabs"
        className="flex items-center gap-2 overflow-x-auto pb-0.5 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {JOURNAL_SUBTABS.map((sub: JournalSubTab, i: number) => (
          <button
            key={sub}
            role="tab"
            aria-selected={subTab === sub}
            aria-controls={`journal-subpanel-${panelId(sub)}`}
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

      {subTab === "Posts" && (
        <><PanelCard>
          <h2 className={panelTitle}>Journal posts</h2>
          <p className="text-sm text-slate-500">Posts sub-tab content</p>
        </PanelCard>
      )}

      {subTab === "Categories" && (
        <><PanelCard>
          <h2 className={panelTitle}>Journal Categories</h2>
          <p className="text-sm text-slate-500">Categories sub-tab content</p>
        </PanelCard>
      )}

      {subTab === "Tags" && (
        <><PanelCard>
          <h2 className={panelTitle}>Journal Tags</h2>
          <p className="text-sm text-slate-500">Tags sub-tab content</p>
        </PanelCard>
      )}
    </>
  );
}