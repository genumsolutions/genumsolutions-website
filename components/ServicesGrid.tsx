"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import ArticleCard from "./ArticleCard";
import type { Service } from "../lib/services";

export default function ServicesGrid({ services }: { services: Service[] }) {
  const [category, setCategory] = useState("All");

  const categories = useMemo(
    () => Array.from(new Set(services.map((s) => s.category).filter(Boolean))),
    [services]
  );
  const filtered = useMemo(
    () => (category === "All" ? services : services.filter((s) => s.category === category)),
    [services, category]
  );

  // 2026-11-13: an admin who unticks every service left this section as a bare
  // heading over an empty grid. Say what happened and give the reader a way
  // forward, instead of the "no services in this category" line, which claimed
  // a filter was responsible when none was.
  if (services.length === 0) {
    return (
      <p className="mt-8 rounded-2xl border border-line bg-white p-5 text-sm leading-6 text-slate-600">
        The service list is being updated.{" "}
        <Link
          href="/contact"
          className="font-bold text-navy underline decoration-gold decoration-2 underline-offset-4"
        >
          Tell us what you need
        </Link>{" "}
        and we will price it directly.
      </p>
    );
  }

  return (
    <>
      {categories.length > 1 && (
        <label className="mt-8 flex max-w-xs items-center gap-2 rounded-full border border-line bg-white px-4 py-2 text-sm font-bold text-muted shadow-sm">
          <span className="sr-only">Filter by category</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full bg-transparent py-1 text-sm font-bold outline-none"
            aria-label="Filter services by category"
          >
            <option value="All">All categories ({services.length})</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c} ({services.filter((s) => s.category === c).length})
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((s) => (
          <ArticleCard
            key={s.id}
            // 2026-11-13 card standard: the rounded panel is what the stream,
            // training and curriculum cards on this page use. Services were the
            // only cards still drawing the border-top variant.
            variant="rounded"
            tag={s.tag || s.category}
            title={s.name}
            description={s.description}
          >
            <p className="mt-2 text-lg font-bold text-ink">{s.priceLabel}</p>
            <Link
              href="/contact"
              className="mt-4 inline-block text-sm font-black text-navy underline decoration-gold decoration-2 underline-offset-4"
            >
              Request a quote
            </Link>
          </ArticleCard>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full rounded-2xl border border-line bg-white p-5 text-sm leading-6 text-slate-600">
            <p>No services in {category} yet.</p>
            <button
              type="button"
              onClick={() => setCategory("All")}
              className="mt-2 font-bold text-navy underline decoration-gold decoration-2 underline-offset-4"
            >
              Show all {services.length} services
            </button>
          </div>
        )}
      </div>
    </>
  );
}
