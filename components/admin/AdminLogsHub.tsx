"use client";

import { useState } from "react";

import AdminLogs from "./AdminLogs";
import AdminProfileEntries from "./AdminProfileEntries";
import AdminUserLogs from "./AdminUserLogs";

// =====================================================================
// AdminLogsHub — one "Logs" tab, three sections.
//
// System Logs, User Logs and Profile Entries were three separate tabs doing
// the same job: read what happened and clear rows out. They became one tab
// with a section switch so an admin can move between the fleet's crash reports,
// the per-user audit trail and the per-user profiles without hunting through
// the tab strip. Panels are the originals, unchanged — this file is only the
// frame, so a fix in one panel still applies everywhere it is used.
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
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

export default function AdminLogsHub() {
  const [section, setSection] = useState<SectionId>("activity");
  const active = SECTIONS.find((s) => s.id === section) ?? SECTIONS[0];

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Log sections">
        {SECTIONS.map((item) => (
          <button
            key={item.id}
            role="tab"
            aria-selected={section === item.id}
            onClick={() => setSection(item.id)}
            className={`rounded-full border px-4 py-1.5 text-xs font-black transition ${
              section === item.id
                ? "border-navy bg-navy text-white"
                : "border-line bg-white text-navy hover:border-navy"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-slate-500">{active.hint}</p>
      <div className="mt-3">
        {section === "activity" && <AdminUserLogs />}
        {section === "profiles" && <AdminProfileEntries />}
        {section === "diagnostics" && <AdminLogs />}
      </div>
    </div>
  );
}
