"use client";

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

import { useState } from "react";
import CategoryControlPanel from "./CategoryControlPanel";
import CategoryOverviewCard from "./CategoryOverviewCard";
import { PROJECT_CATEGORIES } from "../lib/project-catalog";
import { REMOTE_CONTROL_ENABLED, WEBSITE_TRANSPORTS } from "../lib/remote-control";

/**
 * Why each transport can or cannot work from here, straight from the gate.
 * Showing this instead of a flat "paused" note stops the question of "so what
 * would unblock it?" — and keeps a future reader from adding a LAN transport
 * that physically cannot arrive.
 */
function TransportFacts() {
  return (
    <div className="overflow-hidden rounded-xl border border-line">
      <table className="w-full text-left text-xs">
        <thead className="bg-mist text-[10px] uppercase tracking-wider text-muted">
          <tr>
            <th scope="col" className="px-3 py-2 font-black">
              Transport
            </th>
            <th scope="col" className="px-3 py-2 font-black">
              From this website
            </th>
            <th scope="col" className="hidden px-3 py-2 font-black sm:table-cell">
              Why
            </th>
          </tr>
        </thead>
        <tbody>
          {WEBSITE_TRANSPORTS.map((t) => (
            <tr key={t.id} className="border-t border-line">
              <td className="px-3 py-2 font-semibold text-ink">{t.label}</td>
              <td className="px-3 py-2">
                <span
                  className={`inline-flex items-center gap-1.5 font-bold ${
                    t.reachable ? "text-emerald-700" : "text-muted"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`h-2 w-2 rounded-full ${
                      t.reachable ? "bg-emerald-600" : "bg-border"
                    }`}
                  />
                  {t.reachable ? "Possible" : "No"}
                </span>
              </td>
              <td className="hidden px-3 py-2 leading-5 text-muted sm:table-cell">{t.why}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function IotRemote() {
  const [slug, setSlug] = useState<string>(PROJECT_CATEGORIES[0]!.slug);

  const category = PROJECT_CATEGORIES.find((c) => c.slug === slug) ?? PROJECT_CATEGORIES[0]!;

  return (
    <section className="mx-auto max-w-7xl px-5 py-10 lg:px-8 lg:py-12">
      <p className="text-[10px] font-black uppercase tracking-widest text-navy">Control Panel</p>
      <h2 className="mt-2 max-w-2xl font-display text-3xl font-bold text-ink lg:text-4xl">
        Test &amp; control your projects.
      </h2>
      <p className="mt-4 max-w-2xl text-base leading-7 text-muted lg:text-lg">
        {REMOTE_CONTROL_ENABLED
          ? "Pick a project category, connect a device over the cloud relay, and drive or operate it live."
          : "Live control from the website is paused for now — a public web page cannot reach a car on your local network. Drive your projects from the GENUM app over Bluetooth or WiFi."}
      </p>

      {/* Category selector */}
      <div className="mt-8 flex flex-wrap gap-2" role="tablist" aria-label="Project category">
        {PROJECT_CATEGORIES.map((c) => {
          const active = c.slug === slug;
          return (
            <button
              key={c.slug}
              role="tab"
              aria-selected={active}
              onClick={() => setSlug(c.slug)}
              className={`min-h-9 rounded-full px-4 py-2 text-xs font-bold transition ${
                active
                  ? "bg-navy text-white"
                  : "border border-line bg-white text-muted hover:border-navy hover:text-navy"
              }`}
            >
              {c.name}
            </button>
          );
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
            {/* No "http://<car-ip>" here. That address is only reachable from
                inside the car's own network, so sending a public-site visitor
                there is advice that cannot work. See WEBSITE_TRANSPORTS in
                lib/remote-control.ts for the reachability verdicts. */}
            This {category.name.toLowerCase()} project is controlled from the GENUM app right now.
            Web control returns when the cloud relay is live: a relay works because the device dials
            out over the internet, where a public web page cannot dial in.
          </p>
          <div className="mt-4">
            <TransportFacts />
          </div>
        </section>
      )}

      {/* Category overview below the whole remote window — stays on page */}
      <CategoryOverviewCard key={`overview-${category.slug}`} category={category} />
    </section>
  );
}
