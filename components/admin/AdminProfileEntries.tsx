"use client";

import { useEffect, useState } from "react";
import type { ProfileEntriesPage } from "../../lib/user-logs";
import { PAGE_SIZE } from "./admin-types";
import {
  EmptyState,
  LoadingRow,
  Pager,
  RowActions,
  formatTimestamp,
  panelTitle,
  PanelCard,
} from "./admin-helpers";

type EntryRow = {
  id: string;
  user_id: string;
  type_id: string;
  title: string;
  body: Record<string, unknown>;
  typeName: string;
  created_at: string;
  updated_at: string;
};

async function fetchPage(page: number): Promise<ProfileEntriesPage> {
  const response = await fetch(`/api/admin/profile-entries?page=${page}&limit=${PAGE_SIZE}`);
  if (!response.ok) return { entries: [], total: 0, page, totalPages: 1 };
  const json = await response.json();
  return json as ProfileEntriesPage;
}

async function deleteRow(entryId: string): Promise<boolean> {
  const response = await fetch("/api/admin/profile-entries", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: entryId }),
  });
  return response.ok && (await response.json()).ok === true;
}

function confirmDelete(_entryId: string): boolean {
  if (typeof window === "undefined") return true;
  void _entryId;
  return window.confirm("Delete this profile entry? This cannot be undone.");
}

function summarizeBody(body: Record<string, unknown>): string {
  if (!body || Object.keys(body).length === 0) return "";
  try {
    if ("profile_key" in body) {
      return String(body.profile_key ?? "");
    }
    if ("mode_id" in body) {
      return String(body.mode_id ?? "");
    }
    return JSON.stringify(body);
  } catch {
    return "";
  }
}

export default function AdminProfileEntries() {
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    void load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load(p: number) {
    setLoaded(false);
    try {
      const data = await fetchPage(p);
      setEntries(data.entries);
      setTotal(data.total);
      setPage(data.page);
      setTotalPages(data.totalPages);
    } finally {
      setLoaded(true);
    }
  }

  async function handleDelete(rowId: string) {
    if (!confirmDelete(rowId)) return;
    setDeleting(rowId);
    try {
      const ok = await deleteRow(rowId);
      if (ok) {
        setEntries((prev) => prev.filter((r) => r.id !== rowId));
        setTotal((prev) => Math.max(0, prev - 1));
      }
    } finally {
      setDeleting(null);
    }
  }

  return (
    <section
      role="tabpanel"
      id="panel-profile-entries"
      aria-labelledby="tab-profile-entries"
      aria-label="Profile entries"
      className="mt-4 space-y-4"
    >
      <PanelCard>
        <h2 className={panelTitle}>User profile entries</h2>
        <p className="mt-1 text-xs text-slate-500">
          Each car/project profile saved under a user. Admin-only delete.
        </p>
        {!loaded ? (
          <LoadingRow className="mt-3" />
        ) : entries.length === 0 ? (
          <EmptyState className="mt-2">No profile entries yet.</EmptyState>
        ) : (
          <>
            <ul className="mt-3 space-y-2">
              {entries.map((row) => (
                <li key={row.id} className="border border-line bg-white px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-navy-light px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-navy">
                      {row.typeName || "untyped"}
                    </span>
                    <span className="font-medium text-sm text-ink">
                      {row.title || "(untitled)"}
                    </span>
                    <span className="text-xs text-slate-500">{row.user_id.slice(0, 8)}…</span>
                    {summarizeBody(row.body) && (
                      <span className="ml-auto font-mono text-xs text-slate-500">
                        {summarizeBody(row.body)}
                      </span>
                    )}
                  </div>
                  {Object.keys(row.body).length > 0 && summarizeBody(row.body) === "" && (
                    <p className="mt-1 break-words text-xs text-slate-500">
                      {JSON.stringify(row.body)}
                    </p>
                  )}
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                    <span>{formatTimestamp(row.created_at)}</span>
                    {row.updated_at !== row.created_at && (
                      <span className="text-slate-500">
                        · updated {formatTimestamp(row.updated_at)}
                      </span>
                    )}
                  </div>
                  <RowActions
                    actions={[
                      {
                        label: deleting === row.id ? "Deleting…" : "Delete",
                        onClick: () => handleDelete(row.id),
                        tone: "red",
                        show: deleting !== row.id,
                      },
                    ]}
                  />
                </li>
              ))}
            </ul>
            <Pager page={page} totalPages={totalPages} onPage={(p) => void load(p)} />
            <p className="text-xs text-slate-400">
              {total} entr{total === 1 ? "y" : "ies"}
            </p>
          </>
        )}
      </PanelCard>
    </section>
  );
}
