"use client";

import { useEffect, useState } from "react";
import type { ProfileEntriesPage, ProfileEntryType } from "../../lib/user-logs";
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

type ProfileEntriesResponse = ProfileEntriesPage & { types?: ProfileEntryType[] };

type EntryRow = ProfileEntriesPage["entries"][number];

async function fetchPage(page: number): Promise<ProfileEntriesResponse> {
  const response = await fetch(`/api/admin/profile-entries?page=${page}&limit=${PAGE_SIZE}`);
  const json = (await response.json().catch(() => null)) as
    (ProfileEntriesResponse & { error?: string }) | null;
  if (!response.ok) {
    throw new Error(json?.error || `Could not load profile entries (HTTP ${response.status}).`);
  }
  // Guard the page shape: a nested or malformed payload must surface as a clear
  // message, not an unhandled render crash.
  if (!json || !Array.isArray(json.entries)) {
    throw new Error("The server returned an unexpected profile-entries payload.");
  }
  return json;
}

async function deleteRow(entryId: string): Promise<void> {
  const response = await fetch("/api/admin/profile-entries", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: entryId }),
  });
  const json = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
  if (!response.ok || json?.ok !== true) {
    throw new Error(json?.error || `Could not delete the entry (HTTP ${response.status}).`);
  }
}

function confirmDelete(entryId: string): boolean {
  if (typeof window === "undefined") return true;
  void entryId;
  return window.confirm("Delete this profile entry? This cannot be undone.");
}

function summarizeBody(body: Record<string, unknown>): string {
  if (!body || Object.keys(body).length === 0) return "";
  if ("profile_key" in body) return String(body.profile_key ?? "");
  if ("mode_id" in body) return String(body.mode_id ?? "");
  if ("car_name" in body) return String(body.car_name ?? "");
  return JSON.stringify(body);
}

function dedupeRows<T extends { id: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}

export default function AdminProfileEntries() {
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [types, setTypes] = useState<ProfileEntryType[]>([]);
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
      setTypes(data.types ?? []);
      setTotal(data.total);
      setPage(data.page);
      setTotalPages(data.totalPages);
    } catch (e) {
      setEntries([]);
      setError(e instanceof Error ? e.message : "Could not load profile entries.");
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
      setActionError(e instanceof Error ? e.message : "Could not delete the entry.");
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
        {types.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {types.map((type) => (
              <span
                key={type.id}
                className="rounded-full border border-line px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-slate-500"
              >
                {type.name || "untyped"}
              </span>
            ))}
          </div>
        )}
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
            No profile entries yet. Entries appear here once a user saves a car or project profile.
          </EmptyState>
        ) : (
          <>
            <ul className="mt-3 space-y-2">
              {entries.map((row) => {
                const summary = summarizeBody(row.body);
                return (
                  <li key={row.id} className="border border-line bg-white px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-navy-light px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-navy">
                        {row.typeName || "untyped"}
                      </span>
                      <span className="text-sm font-medium text-ink">
                        {row.title || "(untitled)"}
                      </span>
                      {summary && (
                        <span className="ml-auto font-mono text-xs text-slate-500">{summary}</span>
                      )}
                      {row.user_id && (
                        <details className="w-full text-[11px] text-slate-400">
                          <summary className="cursor-pointer font-bold">Technical details</summary>
                          <p className="mt-1 font-mono break-all">user {row.user_id}</p>
                        </details>
                      )}
                    </div>
                    {Object.keys(row.body ?? {}).length > 0 && !summary && (
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
                          onClick: () => void handleDelete(row.id),
                          tone: "red",
                          show: deleting !== row.id,
                        },
                      ]}
                    />
                  </li>
                );
              })}
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
