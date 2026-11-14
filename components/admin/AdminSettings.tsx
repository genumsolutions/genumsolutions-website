"use client";

import { useEffect, useState } from "react";
import { inputClass } from "../../lib/styles";
import { LoadingRow, PanelCard, SaveBar, editorCardTitle } from "./admin-helpers";
import { tabBase, tabActive, tabInactive } from "../lib/styles";

// U-UI2 (2026-11-14): sub-tabs for Settings tab — mirroring the 3D Products pattern.
// Only one sub-tab is visible at a time, sub-tabs are sticky while scrolling.
const SETTINGS_SUBTABS = ["Details", "Contact", "Social"] as const;
type SettingsSubTab = (typeof SETTINGS_SUBTABS)[number];

export default function AdminSettings({ setMessage, canDelete }: { setMessage: (msg: string) => void; canDelete: boolean }) {
  const [subTab, setSubTab] = useState<SettingsSubTab>("Details");

  // U-UI2 sub-tabs strip - sticky, one at a time
  const renderSubTabStrip = () => (
    <div className="sticky top-0 z-20 -mx-5 border-b border-line bg-white/95 px-5 backdrop-blur lg:-mx-8 lg:px-8">
      <div
        role="tablist"
        aria-label="Settings sub-tabs"
        className="flex items-center gap-2 overflow-x-auto pb-0.5 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {SETTINGS_SUBTABS.map((sub: SettingsSubTab, i: number) => (
          <button
            key={sub}
            role="tab"
            aria-selected={subTab === sub}
            aria-controls={`settings-subpanel-${sub}`}
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

      {subTab === "Details" && (
        <><PanelCard>
          <h2 className={panelTitle}>Details</h2>
          <p className="text-sm text-slate-500">Settings details sub-tab content</p>
        </PanelCard>
      )}

      {subTab === "Contact" && (
        <><PanelCard>
          <h2 className={panelTitle}>Contact</h2>
          <p className="text-sm text-slate-500">Settings contact sub-tab content</p>
        </PanelCard>
      )}

      {subTab === "Social" && (
        <><PanelCard>
          <h2 className={panelTitle}>Social</h2>
          <p className="text-sm text-slate-500">Settings social sub-tab content</p>
        </PanelCard>
      )}
    </>
  );
}