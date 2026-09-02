import type { ReactNode } from 'react'
import Link from 'next/link'

type ArticleCardProps = {
  /** Small uppercase tag text shown at top */
  tag?: string
  /** Card title */
  title: string
  /** Card description / body text */
  description?: string
  /** Optional link href — renders a CTA link */
  href?: string
  /** CTA label text */
  cta?: string
  /** Extra content below description (e.g. metadata badges) */
  children?: ReactNode
  /** Variant: default uses border-t, 'rounded' uses rounded-2xl border */
  variant?: 'default' | 'rounded'
}

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
  variant = 'default',
}: ArticleCardProps) {
  const base =
    variant === 'rounded'
      ? 'rounded-2xl border border-line bg-white p-5 sm:p-6'
      : 'border-t-2 border-ink bg-white p-5 sm:p-6'

  return (
    <article className={`${base} flex flex-col`}>
      {tag && (
        <p className="text-xs font-black uppercase tracking-widest text-navy">{tag}</p>
      )}
      <h3 className="mt-4 font-display text-lg font-bold leading-snug sm:text-xl">
        {title}
      </h3>
      {description && (
        <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">{description}</p>
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
  )
}
