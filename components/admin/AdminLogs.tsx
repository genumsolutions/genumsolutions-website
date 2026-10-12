"use client";

import { useEffect, useState } from "react";
import type { LogsList } from "../../lib/logs";
import { PAGE_SIZE } from "./admin-types";
import {
  EmptyState,
  LoadingRow,
  Pager,
  formatTimestamp,
  panelTitle,
  PanelCard,
} from "./admin-helpers";

type CrashRow = {
  id: string;
  board_id: string;
  model_id: string | null;
  fw_version: string;
  app_version: string;
  platform: string;
  connection_method: string;
  reset_reason: string | null;
  boot_count: number | null;
  crash_count: number | null;
  last_crash_phase: string | null;
  last_crash_heap: number | null;
  has_crash: boolean;
  reported_at: string;
};

type AppLogRow = {
  id: string;
  app_version: string;
  platform: string;
  scope: string;
  level: "info" | "warn" | "error";
  message: string;
  detail: Record<string, unknown> | null;
  created_at: string;
};

async function fetchPage<T>(kind: "crash" | "app", page: number): Promise<LogsList<T>> {
  const response = await fetch(`/api/admin/logs?kind=${kind}&page=${page}&limit=${PAGE_SIZE}`);
  return response.ok
    ? ((await response.json()) as LogsList<T>)
    : { entries: [], total: 0, page, totalPages: 1 };
}

function CrashSection() {
  const [entries, setEntries] = useState<CrashRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    void load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load(p: number) {
    setLoaded(false);
    try {
      const data = await fetchPage<CrashRow>("crash", p);
      setEntries(data.entries);
      setTotal(data.total);
      setPage(data.page);
      setTotalPages(data.totalPages);
    } finally {
      setLoaded(true);
    }
  }

  return (
    <PanelCard>
      <h2 className={panelTitle}>Car crash / restart reports</h2>
      <p className="mt-1 text-xs text-slate-500">
        One row per connection session, synced by the app from the car&apos;s stored restart record.
        A <span className="font-bold">crash</span> badge marks an actual crash_count &gt; 0.
      </p>
      {!loaded ? (
        <LoadingRow className="mt-3" />
      ) : entries.length === 0 ? (
        <EmptyState className="mt-2">No crash reports synced yet.</EmptyState>
      ) : (
        <>
          <ul className="mt-3 space-y-2">
            {entries.map((row) => (
              <li key={row.id} className="border border-line bg-white px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[11px] font-black uppercase tracking-wide ${row.has_crash ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-500"}`}
                  >
                    {row.has_crash ? "crash" : "clean"}
                  </span>
                  <span className="font-mono text-sm font-bold">
                    {row.board_id || "(no board id)"}
                  </span>
                  {row.model_id && <span className="text-xs text-slate-500">{row.model_id}</span>}
                  <span className="text-xs text-slate-400">FW {row.fw_version || "?"}</span>
                  <span className="ml-auto text-xs text-slate-400">
                    {row.connection_method} via app v{row.app_version}
                  </span>
                </div>
                {row.has_crash && (
                  <p className="mt-1 text-sm">
                    <span className="font-bold text-red-700">{row.reset_reason ?? "UNKNOWN"}</span>
                    <span className="text-slate-500">
                      {row.crash_count != null
                        ? ` · ${row.crash_count} crash${row.crash_count === 1 ? "" : "es"}`
                        : ""}
                      {row.last_crash_phase ? ` @ ${row.last_crash_phase}` : ""}
                      {row.last_crash_heap != null ? ` · heap ${row.last_crash_heap} B` : ""}
                    </span>
                  </p>
                )}
                <p className="mt-1 text-xs text-slate-400">
                  boot #{row.boot_count ?? "?"} · {formatTimestamp(row.reported_at)}
                </p>
              </li>
            ))}
          </ul>
          <Pager page={page} totalPages={totalPages} onPage={(p) => void load(p)} />
          <p className="text-xs text-slate-400">
            {total} report{total === 1 ? "" : "s"}
          </p>
        </>
      )}
    </PanelCard>
  );
}

function AppLogSection() {
  const [entries, setEntries] = useState<AppLogRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    void load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load(p: number) {
    setLoaded(false);
    try {
      const data = await fetchPage<AppLogRow>("app", p);
      setEntries(data.entries);
      setTotal(data.total);
      setPage(data.page);
      setTotalPages(data.totalPages);
    } finally {
      setLoaded(true);
    }
  }

  return (
    <PanelCard>
      <h2 className={panelTitle}>App logs</h2>
      <p className="mt-1 text-xs text-slate-500">
        Warn/error lines flushed from the phone&apos;s ring buffer (logger + appLogService), newest
        first.
      </p>
      {!loaded ? (
        <LoadingRow className="mt-3" />
      ) : entries.length === 0 ? (
        <EmptyState className="mt-2">No app logs uploaded yet.</EmptyState>
      ) : (
        <>
          <ul className="mt-3 space-y-2">
            {entries.map((row) => (
              <li
                key={row.id}
                className="border border-line bg-white px-3 py-2"
                style={{
                  borderLeft: `4px solid ${row.level === "error" ? "#dc2626" : row.level === "warn" ? "#d97706" : "#1e3a8a"}`,
                }}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs uppercase text-slate-400">{row.level}</span>
                  <span className="font-mono text-xs text-slate-500">[{row.scope}]</span>
                  <span className="ml-auto text-xs text-slate-400">
                    app v{row.app_version || "?"} · {row.platform || "?"}
                  </span>
                </div>
                <p className="mt-0.5 break-words text-sm">{row.message}</p>
                {row.detail && Object.keys(row.detail).length > 0 && (
                  <p className="mt-0.5 break-words text-xs text-slate-500">
                    {JSON.stringify(row.detail)}
                  </p>
                )}
                <p className="mt-0.5 text-xs text-slate-400">{formatTimestamp(row.created_at)}</p>
              </li>
            ))}
          </ul>
          <Pager page={page} totalPages={totalPages} onPage={(p) => void load(p)} />
          <p className="text-xs text-slate-400">
            {total} log{total === 1 ? "" : "s"}
          </p>
        </>
      )}
    </PanelCard>
  );
}

export default function AdminLogs() {
  return (
    <section
      role="tabpanel"
      id="panel-system-logs"
      aria-labelledby="tab-system-logs"
      aria-label="System logs"
      className="mt-4 space-y-4"
    >
      <CrashSection />
      <AppLogSection />
    </section>
  );
}
