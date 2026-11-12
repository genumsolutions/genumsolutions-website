"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cardClass } from "../../lib/styles";

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
  // U-UI1 (2026-11-09): was a square white block with a 2px ink top rule, which
  // made eight heavy black bars across the dashboard. Now the same quiet card
  // the app's StatCard draws — rounded, hairline border, muted label — so the
  // numbers are the loud part, not the frames.
  return (
    <div className="rounded-xl border border-line bg-white p-5">
      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className="mt-2 break-words font-display text-3xl font-bold text-ink">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
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

// U-UI2 (2026-11-12): admin surfaces used a 2px ink top rule and square
// corners, so every panel read as a stack of black bars and the padding
// alternated p-4 / p-6 between neighbours. Admin cards now share one quiet
// anatomy — rounded hairline card, p-5, a bottom-ruled header row — the same
// shape as `Stat` above, so tabs line up with each other and with the app.
// 2026-11-12: the shared card standard lives in lib/styles.ts (cardClass).
// Admin cards inherit it rather than re-declaring padding, so every tab — and
// every card on the storefront — has the same p-5 and the same wrap rules:
// a long title/SKU/URL breaks inside the card instead of pushing past it.
export const panelCard = cardClass;
export const panelListSection = "min-w-0 space-y-4";
export const editorCard = cardClass;
export const editorCardTitle = "font-display text-xl font-bold text-ink";
export const panelTitle = "font-display text-lg font-bold text-ink";
/** Header row: title on the left, filters/actions on the right. */
export const panelHeader =
  "flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between";
/** Compact list row used by orders / messages / subscribers. */
export const panelRow = "min-w-0 break-words rounded-lg border border-line bg-white p-4";

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
  return (
    <p
      className={`min-w-0 break-words rounded-lg border border-dashed border-line bg-white px-4 py-6 text-center text-sm text-slate-500 ${className}`.trim()}
    >
      {children}
    </p>
  );
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
  // 2026-11-12: flex-wrap — two long buttons used to push past the card edge
  // on a phone; they now stack instead.
  return (
    <div className={`mt-5 flex flex-wrap items-center gap-3 ${className}`.trim()}>{children}</div>
  );
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
