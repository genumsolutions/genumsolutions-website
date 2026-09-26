"use client";

import { useState, useMemo } from "react";
import { ChevronDown, Search } from "lucide-react";
import type { Product } from "../lib/catalog";
import { paginate, PAGE_SIZE } from "../lib/catalog";
import { useCart } from "./cart-provider";
import { tabActive, tabBase, tabInactive } from "../lib/styles";
import ProductCard from "./ProductCard";

type ProjectTab = "packages" | "robot-cars";

export type ProjectCategoryEntry = {
  id: string;
  name: string;
  productCount: number;
};

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
  const [tab, setTab] = useState<ProjectTab>("packages");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [page, setPage] = useState(1);
  const { hydrated, count } = useCart();

  const robotCars = useMemo(
    () =>
      products.filter(
        (p) =>
          p.productType === "Project package" &&
          p.project_category === "Robo Car" &&
          p.active !== false
      ),
    [products]
  );

  const otherPackages = useMemo(
    () =>
      products.filter((p) => {
        if (p.active === false) return false;
        // U-44: Pre-packaged Kits ride the packages tab (owner decision).
        if (includeKits && p.category === "Pre-packaged Kits") return true;
        return p.productType === "Project package" && p.project_category !== "Robo Car";
      }),
    [products, includeKits]
  );

  const activeProducts = tab === "packages" ? otherPackages : robotCars;

  const filtered = useMemo(
    () => filterProductsByProjectCategory(activeProducts, category, query),
    [activeProducts, category, query]
  );

  const { items, totalPages, hasMore } = useMemo(() => paginate(filtered, page), [filtered, page]);

  function changeTab(next: ProjectTab) {
    setTab(next);
    setQuery("");
    setCategory("All");
    setPage(1);
  }

  const categoryOptions = useMemo(() => {
    const present = new Set(filtered.map((p) => p.project_category).filter(Boolean));
    return categories.map((c) => ({
      ...c,
      comingSoon: !present.has(c.id) && c.productCount === 0,
    }));
  }, [categories, filtered]);

  return (
    <section className="mx-auto max-w-7xl px-5 py-10 sm:py-12 lg:px-8 lg:py-16">
      <div
        role="tablist"
        aria-label="Project sections"
        className="flex gap-x-5 border-b border-line sm:gap-x-7"
      >
        {[
          { key: "packages" as const, label: "Project Packages", count: otherPackages.length },
          {
            key: "robot-cars" as const,
            label: "Robot Car Projects",
            count: robotCars.length,
          },
        ].map((item) => (
          <button
            key={item.key}
            role="tab"
            aria-selected={tab === item.key}
            onClick={() => changeTab(item.key)}
            className={`${tabBase} ${tab === item.key ? tabActive : tabInactive}`}
          >
            {item.label}
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${tab === item.key ? "bg-navy-light text-navy" : "bg-mist text-muted"}`}
            >
              {item.count}
            </span>
          </button>
        ))}
      </div>
      <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <label className="flex w-full max-w-xs items-center gap-3 rounded-full border border-line bg-white px-4 py-2 text-sm text-muted">
          <Search size={15} aria-hidden="true" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent outline-none placeholder:text-muted"
            placeholder="Search this section"
            aria-label="Search projects"
          />
        </label>
        <div className="flex items-center justify-between gap-6 text-sm text-muted">
          <span>
            {filtered.length} listing{filtered.length === 1 ? "" : "s"}
          </span>
          <span aria-live="polite" className="font-bold text-navy">
            {hydrated && count > 0
              ? `${count} item${count === 1 ? "" : "s"} in build list`
              : "Quote by scope"}
          </span>
        </div>
      </div>

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
                <option key={item.id} value={item.id}>
                  {item.name} (
                  {filterProductsByProjectCategory(activeProducts, item.id, query).length})
                  {item.comingSoon ? " — coming soon" : ""}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {tab === "packages" && (
        <p className="mt-4 text-sm leading-6 text-slate-500">
          Named teaching and automation projects organized by scope.
        </p>
      )}
      {tab === "robot-cars" && (
        <p className="mt-4 text-sm leading-6 text-slate-500">
          Assembled robot-car projects separated from components and materials.
        </p>
      )}

      <div className="mt-5 grid gap-5 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            typeLabel={tab === "robot-cars" ? "Robot Car" : undefined}
          />
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

function filterProductsByProjectCategory(
  list: Product[],
  category: string,
  query: string
): Product[] {
  const needle = query.trim().toLowerCase();
  return list.filter((p) => {
    if (category !== "All" && p.project_category !== category) return false;
    if (!needle) return true;
    return `${p.name} ${p.note} ${p.description}`.toLowerCase().includes(needle);
  });
}
