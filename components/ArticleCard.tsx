import type { ReactNode } from "react";
import Link from "next/link";

type ArticleCardProps = {
  /** Small uppercase tag text shown at top */
  tag?: string;
  /** Card title */
  title: string;
  /** Card description / body text */
  description?: string;
  /** Optional link href — renders a CTA link */
  href?: string;
  /** CTA label text */
  cta?: string;
  /** Extra content below description (e.g. metadata badges) */
  children?: ReactNode;
  /** Variant: default uses border-t, 'rounded' uses rounded-2xl border */
  variant?: "default" | "rounded";
};

/**
 * Reusable card component for service listings, journal posts, 3D printing offers,
 * and any other repeated card pattern across the site.
 */
export default function ArticleCard({
  tag,
  title,
  description,
  href,
  cta,
  children,
  variant = "default",
}: ArticleCardProps) {
  // 2026-11-12 card standard (lib/styles.ts): min-w-0 + break-words so long
  // titles, tags and URLs wrap inside the card instead of widening it, and the
  // same p-5 padding as every other card on the site.
  const base =
    variant === "rounded"
      ? "min-w-0 max-w-full break-words rounded-2xl border border-line bg-white p-5"
      : "min-w-0 max-w-full break-words border-t-2 border-ink bg-white p-5";

  return (
    <article className={`${base} flex flex-col`}>
      {tag && <p className="text-xs font-black uppercase tracking-widest text-navy">{tag}</p>}
      <h3 className="mt-4 break-words font-display text-lg font-bold leading-snug [overflow-wrap:anywhere] sm:text-xl">
        {title}
      </h3>
      {description && (
        <p className="mt-2 flex-1 break-words text-sm leading-6 text-slate-600">{description}</p>
      )}
      {children}
      {href && cta && (
        <Link
          href={href}
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-black text-navy transition hover:gap-2.5"
        >
          {cta}
          <span aria-hidden="true">&rarr;</span>
        </Link>
      )}
    </article>
  );
}
