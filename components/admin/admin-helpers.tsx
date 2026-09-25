"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

export function Pager({
  page,
  totalPages,
  onPage,
}: {
  page: number;
  totalPages: number;
  onPage: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav
      aria-label="Pagination"
      className="mt-4 flex items-center justify-between text-sm font-bold"
    >
      <button
        onClick={() => onPage(page - 1)}
        disabled={page <= 1}
        className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 transition hover:border-navy hover:text-navy disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ChevronLeft size={14} aria-hidden="true" /> Prev
      </button>
      <span aria-live="polite" className="text-slate-500">
        Page {page} of {totalPages}
      </span>
      <button
        onClick={() => onPage(page + 1)}
        disabled={page >= totalPages}
        className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 transition hover:border-navy hover:text-navy disabled:cursor-not-allowed disabled:opacity-40"
      >
        Next <ChevronRight size={14} aria-hidden="true" />
      </button>
    </nav>
  );
}

export function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="border-t-2 border-ink bg-white p-5">
      <p className="text-xs font-black uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-2 break-words font-display text-3xl font-bold text-ink">{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

export function formatTimestamp(ts: string) {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

export function focusEditor(id: string) {
  window.requestAnimationFrame(() => {
    const editor = document.getElementById(id);
    editor?.scrollIntoView({ behavior: "smooth", block: "start" });
    editor?.querySelector<HTMLInputElement>("input, textarea, select")?.focus();
  });
}

// ---------------------------------------------------------------
// Shared panel primitives — the admin panels (Products / Services /
// Journal / Projects / Messages / Activity / Finance / Content) all
// build on the same card + title + rows + save-bar anatomy. Keeping
// these in one place keeps every panel looking consistent.
// ---------------------------------------------------------------

export const panelCard = "min-w-0 border-t-2 border-ink bg-white p-4";
export const panelListSection = "min-w-0 space-y-4";
export const editorCard = "min-w-0 overflow-hidden border-t-2 border-ink bg-white p-4";
export const editorCardTitle = "font-display text-2xl font-bold text-ink";
export const panelTitle = "font-display text-xl font-bold text-ink";

export function PanelCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`${panelCard} ${className}`.trim()}>{children}</div>;
}

export function LoadingRow({ className = "" }: { className?: string }) {
  return (
    <p role="status" className={`text-sm text-slate-500 ${className}`.trim()}>
      Loading…
    </p>
  );
}

export function EmptyState({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <p className={`py-3 text-sm text-slate-500 ${className}`.trim()}>{children}</p>;
}

/** The standard inline row actions (Edit / Preview / Hide / Delete / …). */
export function RowActions({
  actions,
}: {
  actions: {
    label: string;
    onClick: () => void;
    tone?: "navy" | "slate" | "ink" | "red";
    show?: boolean;
  }[];
}) {
  const toneClass: Record<string, string> = {
    navy: "text-navy",
    slate: "text-slate-500",
    ink: "text-ink",
    red: "text-red-600",
  };
  return (
    // W2b (F2): text-link row actions were ~28px tall and cramped together on
    // phones — pad to a 36px tap target and space them out.
    <span className="flex shrink-0 flex-wrap items-center gap-3">
      {actions
        .filter((a) => a.show ?? true)
        .map((a) => (
          <button
            key={a.label}
            onClick={a.onClick}
            className={`flex min-h-[36px] items-center px-1 text-xs font-bold underline ${toneClass[a.tone ?? "ink"]}`}
          >
            {a.label}
          </button>
        ))}
    </span>
  );
}

/** Bottom action bar of an editor form (gold primary + any siblings). */
export function SaveBar({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`mt-5 flex gap-3 ${className}`.trim()}>{children}</div>;
}

export function EditorCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`${editorCard} ${className}`.trim()}>{children}</div>;
}
