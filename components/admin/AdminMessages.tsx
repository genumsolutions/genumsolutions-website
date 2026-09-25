"use client";

import { useEffect, useState } from "react";
import type { Message } from "./admin-types";
import { PAGE_SIZE } from "./admin-types";
import { EmptyState, LoadingRow, Pager, formatTimestamp, panelTitle } from "./admin-helpers";

// C4 (2026-09-23): newsletter opt-ins listed in the Messages panel.
type Subscriber = { id: string; email: string; source: string; status: string; created_at: string };

type Props = { setMessage: (msg: string) => void; canDelete: boolean };

export default function AdminMessages({ setMessage: _setMessage, canDelete }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [filter, setFilter] = useState("");
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [subsLoaded, setSubsLoaded] = useState(false);
  const [subsPage, setSubsPage] = useState(1);
  const [subsTotal, setSubsTotal] = useState(0);
  const [subsTotalPages, setSubsTotalPages] = useState(1);

  useEffect(() => {
    void loadMessages(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void loadSubscribers(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadSubscribers(p: number) {
    setSubsLoaded(false);
    try {
      const response = await fetch(`/api/admin/newsletter?page=${p}&limit=${PAGE_SIZE}`);
      if (response.ok) {
        const data = await response.json();
        setSubscribers(data.subscribers ?? []);
        setSubsTotal(data.total ?? 0);
        setSubsPage(data.page ?? 1);
        setSubsTotalPages(data.totalPages ?? 1);
      }
    } finally {
      setSubsLoaded(true);
    }
  }

  async function deleteSubscriber(id: string) {
    if (!window.confirm("Remove this subscriber? This cannot be undone.")) return;
    const response = await fetch(`/api/admin/newsletter?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (response.ok) {
      setSubscribers((current) => current.filter((s) => s.id !== id));
      setSubsTotal((current) => Math.max(0, current - 1));
    } else {
      const result = await response.json().catch(() => ({}));
      window.alert(result.error || "Could not remove the subscriber.");
    }
  }

  async function loadMessages(p: number) {
    setLoaded(false);
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(PAGE_SIZE) });
      if (filter) params.set("status", filter);
      const response = await fetch(`/api/admin/messages?${params}`);
      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages ?? []);
        setTotal(data.total ?? 0);
        setPage(data.page ?? 1);
        setTotalPages(data.totalPages ?? 1);
      }
    } finally {
      setLoaded(true);
    }
  }

  async function markReplied(id: string) {
    const response = await fetch("/api/admin/messages", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "replied" }),
    });
    if (response.ok)
      setMessages((current) => current.map((m) => (m.id === id ? { ...m, status: "replied" } : m)));
  }

  async function deleteMessage(id: string) {
    if (!window.confirm("Delete this message? This cannot be undone.")) return;
    const response = await fetch(`/api/admin/messages?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (response.ok) {
      setMessages((current) => current.filter((m) => m.id !== id));
      setTotal((current) => Math.max(0, current - 1));
    } else {
      const result = await response.json().catch(() => ({}));
      window.alert(result.error || "Could not delete the message.");
    }
  }

  return (
    <section
      role="tabpanel"
      id="panel-messages"
      aria-labelledby="tab-messages"
      aria-label="Customer messages"
      className="mt-4 space-y-4"
    >
      <div className="flex flex-col gap-3 border-t-2 border-ink bg-white p-6 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <h2 className={panelTitle}>Messages</h2>
        <label className="ml-auto text-sm font-bold text-slate-500">
          Status
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="ml-2 border border-line px-3 py-2 text-sm font-bold"
          >
            <option value="">All</option>
            <option value="new">New</option>
            <option value="replied">Replied</option>
          </select>
        </label>
        <button
          onClick={() => void loadMessages(1)}
          className="bg-navy px-4 py-2 text-xs font-black text-white transition hover:bg-navy-dark"
        >
          Apply
        </button>
      </div>
      {!loaded ? (
        <LoadingRow />
      ) : messages.length === 0 ? (
        <EmptyState>No messages found.</EmptyState>
      ) : (
        <>
          <ul className="space-y-3">
            {messages.map((msg) => (
              <li
                key={msg.id}
                className={`border bg-white p-4 ${msg.status === "new" ? "border-l-4 border-l-navy border-line" : "border-line"}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">
                      {msg.name} <span className="font-normal text-slate-500">· {msg.email}</span>
                    </p>
                    <p className="mt-1 text-xs text-slate-400">{formatTimestamp(msg.created_at)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {msg.status === "new" && (
                      <button
                        onClick={() => markReplied(msg.id)}
                        className="border border-line px-3 py-1.5 text-xs font-bold text-navy transition hover:border-navy"
                      >
                        Mark replied
                      </button>
                    )}
                    {msg.status === "replied" && (
                      <span className="text-[10px] font-black uppercase text-emerald-600">
                        Replied
                      </span>
                    )}
                    {canDelete && (
                      <button
                        onClick={() => deleteMessage(msg.id)}
                        className="border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600 transition hover:bg-red-50"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                  {msg.message}
                </p>
              </li>
            ))}
          </ul>
          <Pager page={page} totalPages={totalPages} onPage={(p) => void loadMessages(p)} />
          <p className="text-xs text-slate-400">
            {total} total message{total === 1 ? "" : "s"}
          </p>
        </>
      )}

      {/* C4 (2026-09-23): Newsletter opt-ins — staff read, admin delete. */}
      <div className="flex flex-col gap-3 border-t-2 border-ink bg-white p-6 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <h2 className={panelTitle}>Newsletter subscribers</h2>
        <button
          onClick={() => void loadSubscribers(1)}
          className="bg-navy px-4 py-2 text-xs font-black text-white transition hover:bg-navy-dark"
        >
          Refresh
        </button>
      </div>
      {!subsLoaded ? (
        <LoadingRow />
      ) : subscribers.length === 0 ? (
        <EmptyState>No subscribers yet.</EmptyState>
      ) : (
        <>
          <ul className="space-y-2">
            {subscribers.map((sub) => (
              <li
                key={sub.id}
                className="flex flex-wrap items-center justify-between gap-2 border border-line bg-white p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{sub.email}</p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {formatTimestamp(sub.created_at)} · via {sub.source}
                  </p>
                </div>
                <span className="shrink-0 text-[10px] font-black uppercase text-emerald-600">
                  {sub.status}
                </span>
                {canDelete && (
                  <button
                    onClick={() => deleteSubscriber(sub.id)}
                    className="shrink-0 border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600 transition hover:bg-red-50"
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
          <Pager
            page={subsPage}
            totalPages={subsTotalPages}
            onPage={(p) => void loadSubscribers(p)}
          />
          <p className="text-xs text-slate-400">
            {subsTotal} total subscriber{subsTotal === 1 ? "" : "s"}
          </p>
        </>
      )}
    </section>
  );
}
