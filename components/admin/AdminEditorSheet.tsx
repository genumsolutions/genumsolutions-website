"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { editorCardTitle } from "./admin-helpers";

/**
 * Admin add/edit forms live behind Add/Edit and open here, above the list they
 * belong to, instead of sitting inline on the page. Closing the sheet returns
 * to the unchanged list.
 */
export function AdminEditorSheet({
  title,
  hint,
  onClose,
  children,
}: {
  title: string;
  hint?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 sm:items-center sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-line bg-white shadow-2xl sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 className={`${editorCardTitle} break-words`}>{title}</h2>
            {hint ? <p className="mt-0.5 text-xs leading-5 text-muted">{hint}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[36px] shrink-0 rounded-full border border-line px-3 text-xs font-bold text-ink transition hover:border-navy"
          >
            Close
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>,
    document.body
  );
}
