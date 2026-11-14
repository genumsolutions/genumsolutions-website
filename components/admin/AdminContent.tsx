"use client";

import { useEffect, useState } from "react";
import { inputClass } from "../../lib/styles";
import AdminRows from "./AdminRows";
import type { RowItem } from "./AdminRows";
import { LoadingRow, PanelCard, SaveBar, editorCardTitle } from "./admin-helpers";
import { tabBase, tabActive, tabInactive } from "../lib/styles";

// U-UI2 (2026-11-14): sub-tabs for Content tab — mirroring the 3D Products pattern.
// Only one sub-tab is visible at a time, sub-tabs are sticky while scrolling.
const CONTENT_SUBTABS = ["Services", "Journal", "Content"] as const;
type ContentSubTab = (typeof CONTENT_SUBTABS)[number];

export default function AdminContent({ setMessage, canDelete }: { setMessage: (msg: string) => void; canDelete: boolean }) {
  const [subTab, setSubTab] = useState<ContentSubTab>("Services");

  // U-UI2 sub-tabs strip - sticky, one at a time
  const renderSubTabStrip = () => (
    <div className="sticky top-0 z-20 -mx-5 border-b border-line bg-white/95 px-5 backdrop-blur lg:-mx-8 lg:px-8">
      <div
        role="tablist"
        aria-label="Content sub-tabs"
        className="flex items-center gap-2 overflow-x-auto pb-0.5 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {CONTENT_SUBTABS.map((sub: ContentSubTab, i: number) => (
          <button
            key={sub}
            role="tab"
            aria-selected={subTab === sub}
            aria-controls={`content-subpanel-${sub}`}
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

      {subTab === "Services" && (
        <><AdminServices setMessage={setMessage} canDelete={canDelete} /></>
      )}

      {subTab === "Journal" && (
        <><AdminJournal setMessage={setMessage} canDelete={canDelete} /></>
      )}

      {subTab === "Content" && (
        <><AdminContent setMessage={setMessage} canDelete={canDelete} /></>
      )}
    </>
  );
}