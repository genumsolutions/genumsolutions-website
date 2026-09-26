"use client";

import { useState, useMemo, useEffect } from "react";
import { Search } from "lucide-react";
import type { Product } from "../lib/catalog";
import { paginate } from "../lib/catalog"; // PAGE_SIZE (20) is paginate's default
import ProductCard from "./ProductCard";

/**
 * U-44 (2026-09-26) — the 3D Products storefront on /3d-printing.
 * Projects-page card idiom (shared ProductCard) with numbered pagination and
 * a 20-per-page limit (owner decision). 3D models live ONLY here — they are
 * excluded from /products (Electronic Products) by applyScope.
 */
export default function ModelsCatalog({ products = [] }: { products?: Product[] }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return products;
    return products.filter((p) =>
      `${p.name} ${p.note} ${p.description}`.toLowerCase().includes(needle)
    );
  }, [products, query]);

  const { items, totalPages, page: safePage } = paginate(filtered, page);
  // Keep the page in range when the list shrinks (search / deletion).
  useEffect(() => {
    setPage((p) => Math.min(p, Math.max(1, totalPages)));
  }, [totalPages]);

  if (products.length === 0) {
    return (
      <p className="rounded-2xl border border-line bg-white p-6 text-sm text-muted">
        No 3D products are listed yet — check back soon, or send us a link and we will print it on
        demand.
      </p>
    );
  }

  return (
    <div>
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
            placeholder="Search models"
            aria-label="Search 3D products"
          />
        </label>
        <span aria-live="polite" className="text-sm text-muted">
          {filtered.length} model{filtered.length === 1 ? "" : "s"} · page {safePage} of{" "}
          {totalPages}
        </span>
      </div>

      <div className="mt-5 grid gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {items.map((product) => (
          <ProductCard key={product.id} product={product} typeLabel="3D Print" />
        ))}
        {filtered.length === 0 && (
          <p className="col-span-full py-8 text-center text-sm text-slate-500">
            No 3D products match your search.
          </p>
        )}
      </div>

      {totalPages > 1 && (
        <nav
          aria-label="3D products pages"
          className="mt-8 flex flex-wrap items-center justify-center gap-1.5"
        >
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setPage(n)}
              aria-current={n === safePage ? "page" : undefined}
              className={`h-9 w-9 rounded-full text-sm font-black transition ${
                n === safePage
                  ? "bg-navy text-white"
                  : "border border-line bg-white text-ink hover:border-navy"
              }`}
            >
              {n}
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}
