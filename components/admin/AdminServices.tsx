"use client";

import { useEffect, useState } from "react";
import { FormEvent, useEffect as useUseEffect, useState as useUseState } from "react";
import { createPortal } from "react-dom";
import { inputClass, cardRow, cardRowText } from "../../lib/styles";
import type { Service } from "./admin-types";
import { emptyService } from "./admin-types";
import {
  EmptyState,
  LoadingRow,
  RowActions,
  SaveBar,
  editorCard,
  editorCardTitle,
  focusEditor,
  panelListSection,
  panelTitle,
  PanelCard,
} from "./admin-helpers";
import { tabBase, tabActive, tabInactive } from "../lib/styles";

// U-UI2 (2026-11-14): sub-tabs for Services tab — mirroring the 3D Products pattern.
// Only one sub-tab is visible at a time, sub-tabs are sticky while scrolling.
const SERVICES_SUBTABS = ["General", "Pricing", "Settings"] as const;
type ServicesSubTab = (typeof SERVICES_SUBTABS)[number];

export default function AdminServices({ setMessage, canDelete }: { setMessage: (msg: string) => void; canDelete: boolean }) {
  const [subTab, setSubTab] = useState<ServicesSubTab>("General");

  // U-UI2 sub-tabs strip - sticky, one at a time
  const renderSubTabStrip = () => (
    <div className="sticky top-0 z-20 -mx-5 border-b border-line bg-white/95 px-5 backdrop-blur lg:-mx-8 lg:px-8">
      <div
        role="tablist"
        aria-label="Services sub-tabs"
        className="flex items-center gap-2 overflow-x-auto pb-0.5 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {SERVICES_SUBTABS.map((sub: ServicesSubTab, i: number) => (
          <button
            key={sub}
            role="tab"
            aria-selected={subTab === sub}
            aria-controls={`services-subpanel-${sub}`}
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

      {subTab === "General" && (
        <><PanelCard>
          <h2 className={panelTitle}>General</h2>
          <p className="text-sm text-slate-500">Services general sub-tab content</p>
        </PanelCard>
      )}

      {subTab === "Pricing" && (
        <><PanelCard>
          <h2 className={panelTitle}>Pricing</h2>
          <p className="text-sm text-slate-500">Services pricing sub-tab content</p>
        </PanelCard>
      )}

      {subTab === "Settings" && (
        <><PanelCard>
          <h2 className={panelTitle}>Settings</h2>
          <p className="text-sm text-slate-500">Services settings sub-tab content</p>
        </PanelCard>
      )}
    </>
  );
}