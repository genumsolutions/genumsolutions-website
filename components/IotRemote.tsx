'use client'

// =====================================================================
// IotRemote - the single "test & play" surface for GENUM device control.
//
// Category selector on the left/top; the selected project's control panel
// renders below. This is the ONLY place controls live on the website - the
// Projects page is descriptions-only. Rendered inside the /tools page.
//
// Owner decision 2026-09-15 (D-1 parked): live remote control is HALTED.
// The live decks render only when REMOTE_CONTROL_ENABLED is true
// (lib/remote-control.ts); the paused state keeps the category selector
// and the descriptive overview card, and directs users to the GENUM app
// or the car's own hosted page.
// =====================================================================

import { useState } from 'react'
import CategoryControlPanel from './CategoryControlPanel'
import CategoryOverviewCard from './CategoryOverviewCard'
import { PROJECT_CATEGORIES } from '../lib/project-catalog'
import { REMOTE_CONTROL_ENABLED } from '../lib/remote-control'

export default function IotRemote() {
  const [slug, setSlug] = useState<string>(PROJECT_CATEGORIES[0]!.slug)

  const category = PROJECT_CATEGORIES.find((c) => c.slug === slug) ?? PROJECT_CATEGORIES[0]!

  return (
    <section className="mx-auto max-w-7xl px-5 py-10 lg:px-8 lg:py-12">
      <p className="text-[10px] font-black uppercase tracking-widest text-navy">
        Control Panel
      </p>
      <h2 className="mt-2 max-w-2xl font-display text-3xl font-bold text-ink lg:text-4xl">
        Test &amp; control your projects.
      </h2>
      <p className="mt-4 max-w-2xl text-base leading-7 text-muted lg:text-lg">
        {REMOTE_CONTROL_ENABLED
          ? 'Pick a project category, connect a Bluetooth or WiFi device, and drive or operate it live.'
          : 'Live device control from the website is paused for now. Control your devices from the GENUM app, or open the car’s own hosted page (http://&lt;car-ip&gt;).'}
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

      {REMOTE_CONTROL_ENABLED ? (
        <CategoryControlPanel key={category.slug} category={category} />
      ) : (
        <section className="mt-6 rounded-2xl border border-line bg-white p-5 shadow-card lg:p-8">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-border" />
            <p className="text-sm font-bold text-ink">Remote control paused</p>
          </div>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
            The website remote panel is temporarily halted. To drive your{' '}
            {category.name.toLowerCase()} device, use the GENUM app (Classic
            Bluetooth or the car’s own WiFi page at <code className="rounded bg-mist px-1 py-0.5 text-xs">http://&lt;car-ip&gt;</code>).
            The project team will re-enable web control once a supported
            transport is defined.
          </p>
        </section>
      )}

      {/* Category overview below the whole remote window — stays on page */}
      <CategoryOverviewCard key={`overview-${category.slug}`} category={category} />
    </section>
  )
}
