"use client";

import { useState, useMemo } from "react";
import { ChevronDown, Search } from "lucide-react";
import type { Product } from "../lib/catalog";
import { paginate, PAGE_SIZE } from "../lib/catalog";
import { useCart } from "./cart-provider";
import ProductCard from "./ProductCard";

export type ProjectCategoryEntry = {
  id: string;
  name: string;
  productCount: number;
};

// U-47 (2026-09-27, owner): ONE unified projects grid — no more Packages /
// Robot-Cars tabs. Every project package displays as a card; the category
// selector filters by the SIX owner-named categories (Robo Car, Smart Home,
// Smart Farm, Smart City, Smart Dustbin, Aerial Drones) read from
// project_categories in the DB. Empty categories show as coming soon.
export default function ProjectsCatalog({
  products = [],
  categories = [],
  includeKits = false,
}: {
  products?: Product[];
  categories?: ProjectCategoryEntry[];
  /** U-44 (owner): Pre-packaged Kits display on the projects page. */
  includeKits?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [page, setPage] = useState(1);
  const { count } = useCart();

  const allProjects = useMemo(
    () =>
      products.filter((p) => {
        if (p.active === false) return false;
        // U-44: Pre-packaged Kits ride the projects page (owner decision).
        if (includeKits && p.category === "Pre-packaged Kits") return true;
        return p.productType === "Project package";
      }),
    [products, includeKits]
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return allProjects.filter((p) => {
      if (category !== "All" && p.project_category !== category) return false;
      if (!needle) return true;
      return `${p.name} ${p.note} ${p.description}`.toLowerCase().includes(needle);
    });
  }, [allProjects, category, query]);

  const { items, totalPages, hasMore } = useMemo(() => paginate(filtered, page), [filtered, page]);

  const categoryOptions = useMemo(() => {
    // project_category stores the category NAME ("Robo Car", "Smart
    // Dustbin", …) — match on name, the store's rows carry the same names.
    const present = new Set(allProjects.map((p) => p.project_category).filter(Boolean));
    return categories.map((c) => ({
      ...c,
      comingSoon: !present.has(c.name) && c.productCount === 0,
    }));
  }, [categories, allProjects]);

  return (
    <section className="mx-auto max-w-7xl px-5 py-10 sm:py-12 lg:px-8 lg:py-16">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <label className="flex w-full max-w-xs items-center gap-3 rounded-full border border-line bg-white px-4 py-2 text-sm text-muted">
          <Search size={15} aria-hidden="true" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            className="w-full bg-transparent outline-none placeholder:text-muted"
            placeholder="Search projects"
            aria-label="Search projects"
          />
        </label>
        <div className="flex items-center justify-between gap-6 text-sm text-muted">
          <span>
            {filtered.length} listing{filtered.length === 1 ? "" : "s"}
          </span>
          <span aria-live="polite" className="font-bold text-navy">
            {count > 0 ? `${count} item${count === 1 ? "" : "s"} in build list` : "Quote by scope"}
          </span>
        </div>
      </div>

      {/* Category selector — the SIX canonical project categories. */}
      {categoryOptions.length > 0 && (
        <div className="mt-4">
          <label className="flex min-h-[44px] w-full items-center gap-2 rounded-full border border-line bg-white px-4 text-sm font-bold text-muted shadow-sm sm:w-64">
            <span className="sr-only">Filter projects by category</span>
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
              aria-label="Filter projects by category"
              className="w-full bg-transparent py-2 text-sm font-bold outline-none"
            >
              <option value="All">All categories ({filtered.length})</option>
              {categoryOptions.map((item) => (
                <option key={item.id} value={item.name}>
                  {item.name} ({allProjects.filter((p) => p.project_category === item.name).length})
                  {item.comingSoon ? " — coming soon" : ""}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {/* 2 per row on phones (owner: match the app), up to 5 at xl. */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {items.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
        {filtered.length === 0 && (
          <p className="col-span-full py-8 text-center text-sm text-slate-500">
            No projects found matching your filters.
          </p>
        )}
      </div>

      {hasMore && (
        <div className="mt-10 flex flex-col items-center gap-3">
          <button
            onClick={() => setPage((p) => p + 1)}
            className="inline-flex h-12 items-center gap-2 rounded-full bg-navy px-8 text-sm font-black text-white shadow-sm transition hover:bg-navy-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
          >
            See more <ChevronDown size={16} aria-hidden="true" />
          </button>
          <p className="text-xs text-muted">
            Showing {Math.min(filtered.length, page * PAGE_SIZE)} of {filtered.length} — page {page}{" "}
            of {totalPages}
          </p>
        </div>
      )}
      {!hasMore && filtered.length > 0 && (
        <p className="mt-10 text-center text-xs text-muted">
          You have seen all {filtered.length} listings.
        </p>
      )}
    </section>
  );
}
