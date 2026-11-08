"use client";

import { useEffect, useState } from "react";
import type { UserLogsPage } from "../../lib/user-logs";
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

type LogRow = {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
};

async function fetchPage(page: number): Promise<UserLogsPage> {
  const response = await fetch(`/api/admin/user-logs?page=${page}&limit=${PAGE_SIZE}`);
  return response.ok
    ? ((await response.json()) as UserLogsPage)
    : { entries: [], total: 0, page, totalPages: 1 };
}

async function deleteRow(logId: string): Promise<boolean> {
  const response = await fetch("/api/admin/user-logs", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: logId }),
  });
  return response.ok && (await response.json()).ok === true;
}

function confirmDelete(_logId: string): boolean {
  if (typeof window === "undefined") return true;
  void _logId;
  return window.confirm("Delete this user activity log entry? This cannot be undone.");
}

export default function AdminUserLogs() {
  const [entries, setEntries] = useState<LogRow[]>([]);
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
      id="panel-user-logs"
      aria-labelledby="tab-user-logs"
      aria-label="User logs"
      className="mt-4 space-y-4"
    >
      <PanelCard>
        <h2 className={panelTitle}>User activity logs</h2>
        <p className="mt-1 text-xs text-slate-500">
          Per-user audit entries logged by the app. Admin-only delete.
        </p>
        {!loaded ? (
          <LoadingRow className="mt-3" />
        ) : entries.length === 0 ? (
          <EmptyState className="mt-2">No user activity logs yet.</EmptyState>
        ) : (
          <>
            <ul className="mt-3 space-y-2">
              {entries.map((row) => (
                <li key={row.id} className="border border-line bg-white px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-slate-400">
                      {row.action || "(no action)"}
                    </span>
                    {row.entity_type && (
                      <span className="text-xs text-slate-500">{row.entity_type}</span>
                    )}
                    {row.entity_id && (
                      <span className="font-mono text-xs text-slate-500">
                        {row.entity_id.slice(0, 8)}…
                      </span>
                    )}
                    <span className="ml-auto text-xs text-slate-400">
                      {formatTimestamp(row.created_at)}
                    </span>
                  </div>
                  {row.details && Object.keys(row.details).length > 0 && (
                    <p className="mt-1 break-words text-xs text-slate-500">
                      {JSON.stringify(row.details)}
                    </p>
                  )}
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
