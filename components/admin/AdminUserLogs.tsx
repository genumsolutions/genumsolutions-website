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

type LogRow = UserLogsPage["entries"][number];

async function fetchPage(page: number): Promise<UserLogsPage> {
  const response = await fetch(`/api/admin/user-logs?page=${page}&limit=${PAGE_SIZE}`);
  const json = (await response.json().catch(() => null)) as
    (UserLogsPage & { error?: string }) | null;
  if (!response.ok) {
    throw new Error(json?.error || `Could not load user activity logs (HTTP ${response.status}).`);
  }
  if (!json || !Array.isArray(json.entries)) {
    throw new Error("The server returned an unexpected user-logs payload.");
  }
  return json;
}

async function deleteRow(logId: string): Promise<void> {
  const response = await fetch("/api/admin/user-logs", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: logId }),
  });
  const json = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
  if (!response.ok || json?.ok !== true) {
    throw new Error(json?.error || `Could not delete the log entry (HTTP ${response.status}).`);
  }
}

function confirmDelete(logId: string): boolean {
  if (typeof window === "undefined") return true;
  void logId;
  return window.confirm("Delete this user activity log entry? This cannot be undone.");
}

function dedupeRows<T extends { id: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}

export default function AdminUserLogs() {
  const [entries, setEntries] = useState<LogRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
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
    setError(null);
    try {
      const data = await fetchPage(p);
      setEntries(dedupeRows(data.entries));
      setTotal(data.total);
      setPage(data.page);
      setTotalPages(data.totalPages);
    } catch (e) {
      setEntries([]);
      setError(e instanceof Error ? e.message : "Could not load user activity logs.");
    } finally {
      setLoaded(true);
    }
  }

  async function handleDelete(rowId: string) {
    if (!confirmDelete(rowId)) return;
    setDeleting(rowId);
    setActionError(null);
    try {
      await deleteRow(rowId);
      setEntries((prev) => prev.filter((r) => r.id !== rowId));
      setTotal((prev) => Math.max(0, prev - 1));
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Could not delete the log entry.");
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
        {actionError && (
          <p className="mt-3 border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
            {actionError}
          </p>
        )}
        {!loaded ? (
          <LoadingRow className="mt-3" />
        ) : error ? (
          <p className="mt-3 border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
            {error}{" "}
            <button
              type="button"
              onClick={() => void load(page)}
              className="ml-1 underline underline-offset-2"
            >
              Retry
            </button>
          </p>
        ) : entries.length === 0 ? (
          <EmptyState className="mt-2">
            No user activity logs yet. Entries appear here as signed-in users use the app.
          </EmptyState>
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
                    <span className="ml-auto text-xs text-slate-400">
                      {formatTimestamp(row.created_at)}
                    </span>
                  </div>
                  <details className="mt-1 text-[11px] text-slate-400">
                    <summary className="cursor-pointer font-bold">Technical details</summary>
                    <p className="mt-1 font-mono break-all">
                      {row.user_id ? `user ${row.user_id}` : ""}
                      {row.entity_id ? ` · entity ${row.entity_id}` : ""}
                    </p>
                  </details>
                  {row.details && Object.keys(row.details).length > 0 && (
                    <p className="mt-1 break-words text-xs text-slate-500">
                      {JSON.stringify(row.details)}
                    </p>
                  )}
                  <RowActions
                    actions={[
                      {
                        label: deleting === row.id ? "Deleting…" : "Delete",
                        onClick: () => void handleDelete(row.id),
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
