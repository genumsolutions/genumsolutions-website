"use client";

import { useEffect, useState } from "react";
import { inputClass } from "../../lib/styles";
import { isAdminRole, isOwnerRole } from "../../lib/roles";
import type { UserPage, ManagedUser } from "./admin-types";
import { PAGE_SIZE } from "./admin-types";
import { Pager } from "./admin-helpers";
import { tabBase, tabActive, tabInactive } from "../lib/styles";

// U-UI2 (2026-11-14): sub-tabs for Users tab — mirroring the 3D Products pattern.
// Only one sub-tab is visible at a time, sub-tabs are sticky while scrolling.
const USERS_SUBTABS = ["Users", "Projects", "Robot Profiles"] as const;
type UsersSubTab = (typeof USERS_SUBTABS)[number];

export default function AdminUsers({ setMessage, canDelete }: { setMessage: (msg: string) => void; canDelete: boolean }) {
  const [subTab, setSubTab] = useState<UsersSubTab>("Users");

  // U-UI2 sub-tabs strip - sticky, one at a time
  const renderSubTabStrip = () => (
    <div className="sticky top-0 z-20 -mx-5 border-b border-line bg-white/95 px-5 backdrop-blur lg:-mx-8 lg:px-8">
      <div
        role="tablist"
        aria-label="Users sub-tabs"
        className="flex items-center gap-2 overflow-x-auto pb-0.5 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {USERS_SUBTABS.map((sub: UsersSubTab, i: number) => (
          <button
            key={sub}
            role="tab"
            aria-selected={subTab === sub}
            aria-controls={`users-subpanel-${sub}`}
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

      {subTab === "Users" && (
        <></* Users content would go here */><PanelCard>
          <h2 className={/* panelTitle */}>Users</h2>
          <p className="text-sm text-slate-500">Users sub-tab content</p>
        </PanelCard>
      )}

      {subTab === "Projects" && (
        <><PanelCard>
          <h2 className={/* panelTitle */}>Projects</h2>
          <p className="text-sm text-slate-500">Projects sub-tab content</p>
        </PanelCard>
      )}

      {subTab === "Robot Profiles" && (
        <><PanelCard>
          <h2 className={/* panelTitle */}>Robot Profiles</h2>
          <p className="text-sm text-slate-500">Robot profiles sub-tab content</p>
        </PanelCard>
      )}
    </>
  );
}