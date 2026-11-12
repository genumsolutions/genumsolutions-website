export const inputClass =
  "rounded-lg border border-line bg-white px-4 py-3 text-sm font-medium outline-none transition placeholder:text-muted focus:border-navy focus:ring-2 focus:ring-navy/20";

export const btnPrimary =
  "rounded-full bg-navy px-5 py-3 text-sm font-black text-white transition hover:bg-navy-dark";

export const btnOutline =
  "rounded-full border border-line px-5 py-3 text-sm font-bold text-muted transition hover:border-navy hover:text-navy";

export const tabBase =
  "relative -mb-px inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap border-b-2 px-2 pb-3 pt-2 text-sm font-bold uppercase tracking-wider transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy";

export const tabActive = "border-navy text-navy";
export const tabInactive = "border-transparent text-muted hover:border-border hover:text-ink";

// ---------------------------------------------------------------
// Card standards (2026-11-12)
// One card anatomy for the whole site: rounded hairline panel, p-5, and
// `min-w-0` + `break-words` so a long product name, SKU, email or URL can
// never widen the card or spill out of it. Every card-shaped surface should
// use these instead of re-declaring padding per component — that is what made
// neighbouring cards disagree on padding and let text overflow in the admin
// Content tab.
// ---------------------------------------------------------------
export const cardClass =
  "min-w-0 max-w-full break-words rounded-xl border border-line bg-white p-5";
export const cardTitle = "min-w-0 break-words font-display text-lg font-bold leading-snug text-ink";
export const cardBodyText = "min-w-0 break-words text-sm leading-6 text-muted";
/** A row inside a card: text shrinks/wraps, actions jump to the next line. */
export const cardRow =
  "flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5 py-3 first:pt-0 last:pb-0";
/** The text column of a `cardRow` — long unbroken tokens break instead of spill. */
export const cardRowText =
  "min-w-0 flex-1 break-words text-sm leading-snug [overflow-wrap:anywhere]";
