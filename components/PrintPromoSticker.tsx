"use client";

/**
 * Landing-page 3D-printing offer sticker.
 *
 * 2026-11-14 (owner): "i want the promotional price for the 3d printing of the
 * rs. 10 per gram in the landing page, like a sticker … and also have them
 * close button so that it doesn't become irritating when displaying and
 * working with other things."
 *
 * The copy is NOT hard-coded: it prints whatever the active `print_promotions`
 * row says, so Admin → 3D Products → Promotions owns the wording, the dates
 * and whether it shows at all. The "first year only" framing lives in that
 * row's title/body and therefore appears here verbatim.
 *
 * Dismissal is per promotion id and stored in localStorage: closing it keeps it
 * closed on this device, and publishing a *new* promotion id (or clearing the
 * end date and starting a new one) brings the sticker back.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, X } from "lucide-react";
import type { PrintPromotion } from "../lib/print";
import { promotionBadge } from "../lib/print";

const storageKey = (id: string) => `genum.print-promo.dismissed.${id}`;

export default function PrintPromoSticker({ promo }: { promo: PrintPromotion | null }) {
  // "unknown" paints nothing on the first pass — without it, a visitor who has
  // already dismissed the sticker sees it flash and disappear on every load.
  const [state, setState] = useState<"unknown" | "shown" | "hidden">("unknown");

  useEffect(() => {
    if (!promo) {
      setState("hidden");
      return;
    }
    try {
      setState(window.localStorage.getItem(storageKey(promo.id)) ? "hidden" : "shown");
    } catch {
      // Private mode / storage disabled: show it, closing just won't persist.
      setState("shown");
    }
  }, [promo]);

  if (!promo || state !== "shown") return null;

  const badge = promotionBadge(promo);

  function dismiss() {
    setState("hidden");
    if (!promo) return;
    try {
      window.localStorage.setItem(storageKey(promo.id), new Date().toISOString());
    } catch {
      /* the sticker is already gone for this visit */
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-5 pt-4 lg:px-8">
      <div className="relative overflow-hidden rounded-2xl border border-gold/60 bg-gold/10 px-4 py-3 pr-12 sm:px-5 sm:py-4 sm:pr-14">
        <span className="absolute inset-y-0 left-0 w-1.5 bg-gold" aria-hidden="true" />
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 pl-2">
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-gold px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-ink">
            <Sparkles size={12} aria-hidden="true" />
            First-year offer
          </span>
          <p className="min-w-0 break-words text-sm font-black text-ink sm:text-base">
            {promo.title}
            {badge ? <span className="ml-2 text-navy">{badge}</span> : null}
          </p>
          {promo.body ? (
            <p className="min-w-0 basis-full break-words text-xs leading-5 text-slate-600 sm:basis-auto">
              {promo.body}
            </p>
          ) : null}
          {promo.ctaLabel ? (
            <Link
              href={promo.ctaHref || "/3d-printing"}
              className="ml-auto inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-full bg-navy px-4 text-xs font-black text-white transition hover:bg-navy-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
            >
              {promo.ctaLabel}
            </Link>
          ) : null}
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss the 3D printing offer"
          className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-transparent text-slate-500 transition hover:border-line hover:bg-white hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
