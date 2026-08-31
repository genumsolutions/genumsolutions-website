'use client'

// =====================================================================
// IotRemote - the single "test & play" surface for GENUM device control.
//
// Category selector on the left/top; the selected project's control panel
// renders below. This is the ONLY place controls live on the website - the
// Projects page is descriptions-only. Rendered inside the /tools page.
// =====================================================================

import { useState } from 'react'
import CategoryControlPanel from './CategoryControlPanel'
import { PROJECT_CATEGORIES } from '../lib/project-catalog'

export default function IotRemote() {
  const [slug, setSlug] = useState<string>(PROJECT_CATEGORIES[0]!.slug)
  const category = PROJECT_CATEGORIES.find((c) => c.slug === slug) ?? PROJECT_CATEGORIES[0]!

  return (
    <section className="mx-auto max-w-7xl px-5 py-10 lg:px-8 lg:py-12">
      <p className="text-[10px] font-black uppercase tracking-widest text-navy">
        IoT &amp; Remote Controller
      </p>
      <h2 className="mt-2 max-w-2xl font-display text-3xl font-bold text-ink lg:text-4xl">
        Test &amp; control your projects.
      </h2>
      <p className="mt-4 max-w-2xl text-base leading-7 text-muted lg:text-lg">
        Pick a project category, connect a Bluetooth or WiFi device, and drive or
        operate it live.
      </p>

      {/* Category selector */}
      <div className="mt-8 flex flex-wrap gap-2" role="tablist" aria-label="Project category">
        {PROJECT_CATEGORIES.map((c) => {
          const active = c.slug === slug
          return (
            <button
              key={c.slug}
              role="tab"
              aria-selected={active}
              onClick={() => setSlug(c.slug)}
              className={`rounded-full px-4 py-2 text-xs font-bold transition ${
                active ? 'bg-navy text-white' : 'border border-line bg-white text-muted hover:border-navy hover:text-navy'
              }`}
            >
              {c.name}
            </button>
          )
        })}
      </div>

      {/* Selected category intro */}
      <div className="mt-6">
        <h2 className="font-display text-xl font-bold text-ink">{category.name}</h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">{category.description}</p>
        {category.hardware.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2">
            {category.hardware.map((h) => (
              <li key={h} className="rounded-full bg-mist px-3 py-1.5 text-xs font-bold text-navy">
                {h}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Control panel for the selected category */}
      <CategoryControlPanel key={category.slug} category={category} />
    </section>
  )
}
