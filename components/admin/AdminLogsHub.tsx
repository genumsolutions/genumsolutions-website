"use client";

import { useState } from "react";

import {
  adminSectionPill,
  adminSectionPillActive,
  adminSectionPillInactive,
  adminSectionStrip,
} from "../../lib/styles";
import AdminLogs from "./AdminLogs";
import AdminProfileEntries from "./AdminProfileEntries";
import AdminProjectDrift from "./AdminProjectDrift";
import AdminUserLogs from "./AdminUserLogs";

// =====================================================================
// AdminLogsHub — one "Logs" tab, four sections.
//
// System Logs, User Logs and Profile Entries were three separate tabs doing
// the same job: read what happened and clear rows out. They became one tab
// with a section switch so an admin can move between the fleet's crash reports,
// the per-user audit trail and the per-user profiles without hunting through
// the tab strip. Panels are the originals, unchanged — this file is only the
// frame, so a fix in one panel still applies everywhere it is used.
//
// 2026-11-18: a fourth section ("Data checks") carries the project-detail drift
// report, which is a catalog-integrity question, not a log — it lives here so
// the rollout has a visible place to stand without adding a tab.
// =====================================================================

const SECTIONS = [
  {
    id: "activity",
    label: "User activity",
    hint: "Every saved profile, placed order and status change, newest first.",
  },
  {
    id: "profiles",
    label: "User profiles",
    hint: "Per-user car/project profiles mirrored from car_profiles.",
  },
  {
    id: "diagnostics",
    label: "Fleet diagnostics",
    hint: "Device crash reports and app log lines from the field.",
  },
  {
    id: "drift",
    label: "Data checks",
    hint: "Catalog rows whose two project-detail copies disagree during the columns rollout.",
  },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

export default function AdminLogsHub() {
  // 2026-11-18: this hub is the Users tab's Diagnostics window now, so it
  // opens on the fleet diagnostics (crash reports + app logs) instead of user
  // activity. The other two sections stay one click away.
  const [section, setSection] = useState<SectionId>("diagnostics");
  const active = SECTIONS.find((s) => s.id === section) ?? SECTIONS[0];

  return (
    <div>
      {/* A filter group, not a tablist: the three panels are separate
          regions, so announcing them as tabs without tabpanels was wrong. */}
      <div className={adminSectionStrip} role="group" aria-label="Log sections">
        {SECTIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={section === item.id}
            onClick={() => setSection(item.id)}
            className={`${adminSectionPill} ${
              section === item.id ? adminSectionPillActive : adminSectionPillInactive
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted">{active.hint}</p>
      <div className="mt-3">
        {section === "activity" && <AdminUserLogs />}
        {section === "profiles" && <AdminProfileEntries />}
        {section === "diagnostics" && <AdminLogs />}
        {section === "drift" && <AdminProjectDrift />}
      </div>
    </div>
  );
}
