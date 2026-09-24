"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Search } from "lucide-react";
import type { Product, SortOption } from "../lib/catalog";
import {
  applyScope,
  filterProducts,
  inStockOnly,
  isSortOption,
  paginate,
  PAGE_SIZE,
  PRICE_CEILINGS,
  priceCeilingLabel,
  resolveRecentlyViewed,
  SORT_LABELS,
  sortProducts,
  withinPrice,
} from "../lib/catalog";
import { loadRecentlyViewed } from "../lib/recently-viewed";
import { useCart } from "./cart-provider";
import ProductCard from "./ProductCard";

export default function ProductCatalog({
  scope = "components",
  products = [],
  initialPage = 1,
  initialQuery = "",
  initialCategory = "All",
  initialSort = "featured",
  initialMaxPrice = 0,
  initialInStock = false,
}: {
  scope?: string;
  products?: Product[];
  initialPage?: number;
  initialQuery?: string;
  initialCategory?: string;
  initialSort?: SortOption;
  initialMaxPrice?: number;
  initialInStock?: boolean;
}) {
  const router = useRouter();
  const [category, setCategory] = useState(initialCategory);
  const [query, setQuery] = useState(initialQuery);
  const [sort, setSort] = useState<SortOption>(
    isSortOption(initialSort) ? initialSort : "featured"
  );
  const [maxPrice, setMaxPrice] = useState(initialMaxPrice);
  const [inStock, setInStock] = useState(initialInStock);
  const [page, setPage] = useState(Math.max(1, initialPage));
  const { count, hydrated } = useCart();
  // C3 (2026-09-23): "Recently viewed" strip. Empty on the server and filled
  // after mount (localStorage) — so SSR output is deterministic and private
  // mode just hides the row.
  const [recent, setRecent] = useState<Product[]>([]);

  useEffect(() => {
    setRecent(resolveRecentlyViewed(products, loadRecentlyViewed()));
  }, [products]);

  const scopedProducts = useMemo(
    () => applyScope(products, scope).filter((product) => product.active !== false),
    [products, scope]
  );

  const categories = useMemo(() => {
    const present: string[] = [];
    for (const p of scopedProducts) {
      if (!present.includes(p.category)) present.push(p.category);
    }
    return present;
  }, [scopedProducts]);

  const filtered = useMemo(
    () =>
      inStockOnly(
        withinPrice(sortProducts(filterProducts(scopedProducts, category, query), sort), maxPrice),
        inStock
      ),
    [scopedProducts, category, query, sort, maxPrice, inStock]
  );

  const {
    items,
    page: activePage,
    total,
    totalPages,
    hasMore,
  } = useMemo(() => paginate(filtered, page), [filtered, page]);

  // Keep the URL in sync so /products?page=2&q=...&category=...&sort=... are
  // real, shareable sub-pages (this is what the app's WebView mirrors too).
  function syncUrl(next: {
    category?: string;
    query?: string;
    page?: number;
    sort?: SortOption;
    maxPrice?: number;
    inStock?: boolean;
  }) {
    const params = new URLSearchParams();
    const cat = next.category ?? category;
    const q = next.query ?? query;
    const st = next.sort ?? sort;
    const mp = next.maxPrice ?? maxPrice;
    const stock = next.inStock ?? inStock;
    if (cat !== "All") params.set("category", cat);
    if (q.trim()) params.set("q", q.trim());
    if (st !== "featured") params.set("sort", st);
    if (mp > 0) params.set("maxPrice", String(mp));
    if (stock) params.set("inStock", "1");
    if (next.page && next.page > 1) params.set("page", String(next.page));
    const qs = params.toString();
    router.replace(qs ? `/products?${qs}` : "/products", { scroll: false });
  }

  function chooseCategory(next: string) {
    setCategory(next);
    setPage(1);
    syncUrl({ category: next, page: 1 });
  }

  function handleQueryChange(value: string) {
    setQuery(value);
    setPage(1);
    syncUrl({ query: value, page: 1 });
  }

  function chooseSort(next: SortOption) {
    setSort(next);
    setPage(1);
    syncUrl({ sort: next, page: 1 });
  }

  function chooseMaxPrice(next: number) {
    setMaxPrice(next);
    setPage(1);
    syncUrl({ maxPrice: next, page: 1 });
  }

  function toggleInStock(next: boolean) {
    setInStock(next);
    setPage(1);
    syncUrl({ inStock: next, page: 1 });
  }

  function loadMore() {
    const next = page + 1;
    setPage(next);
    syncUrl({ page: next });
  }

  return (
    <section className="mx-auto max-w-7xl px-5 py-10 sm:py-12 lg:px-8 lg:py-16">
      <div className="border-b border-line pb-5 sm:pb-6">
        <label className="flex min-h-[52px] items-center gap-3 rounded-full border border-line bg-white px-5 text-muted shadow-sm focus-within:border-navy sm:w-full sm:max-w-md">
          <Search size={18} aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => handleQueryChange(event.target.value)}
            className="w-full bg-transparent py-3 text-base outline-none placeholder:text-muted"
            placeholder="Search by name, part, or use"
            aria-label="Search products"
          />
          {query && (
            <button
              onClick={() => handleQueryChange("")}
              aria-label="Clear search"
              className="text-xs font-bold text-navy underline-offset-2 hover:underline"
            >
              Clear
            </button>
          )}
        </label>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="flex min-h-[44px] items-center gap-2 rounded-full border border-line bg-white px-4 text-sm font-bold text-muted shadow-sm sm:w-auto">
            <span className="sr-only">Filter by category</span>
            <select
              value={category}
              onChange={(event) => chooseCategory(event.target.value)}
              aria-label="Filter products by category"
              className="w-full bg-transparent py-2 text-sm font-bold outline-none sm:w-56"
            >
              <option value="All">All categories</option>
              {categories.map((item) => (
                <option key={item} value={item}>
                  {item} ({filterProducts(scopedProducts, item, query).length})
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-h-[44px] items-center gap-2 rounded-full border border-line bg-white px-4 text-sm font-bold text-muted shadow-sm sm:w-auto">
            <span className="sr-only">Sort products</span>
            <select
              value={sort}
              onChange={(event) =>
                chooseSort(isSortOption(event.target.value) ? event.target.value : "featured")
              }
              aria-label="Sort products"
              className="w-full bg-transparent py-2 text-sm font-bold outline-none sm:w-52"
            >
              {(Object.keys(SORT_LABELS) as SortOption[]).map((option) => (
                <option key={option} value={option}>
                  {SORT_LABELS[option]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-h-[44px] items-center gap-2 rounded-full border border-line bg-white px-4 text-sm font-bold text-muted shadow-sm sm:w-auto">
            <span className="sr-only">Filter by maximum price</span>
            <select
              value={maxPrice}
              onChange={(event) => chooseMaxPrice(Number(event.target.value) || 0)}
              aria-label="Filter by maximum price"
              className="w-full bg-transparent py-2 text-sm font-bold outline-none sm:w-48"
            >
              {PRICE_CEILINGS.map((ceiling) => (
                <option key={ceiling} value={ceiling}>
                  {priceCeilingLabel(ceiling)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full border border-line bg-white px-4 py-2 text-sm font-bold text-muted shadow-sm">
            <input
              type="checkbox"
              checked={inStock}
              onChange={(event) => toggleInStock(event.target.checked)}
              aria-label="Show in-stock products only"
              className="h-4 w-4 accent-navy"
            />
            In stock only
          </label>
          <span className="text-xs text-muted">{filtered.length} total</span>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
          <span aria-live="polite">
            {total} listing{total === 1 ? "" : "s"} found
            {category !== "All" && (
              <>
                {" "}
                in <strong className="text-navy">{category}</strong>
              </>
            )}
          </span>
          <span className="font-bold text-navy">
            {hydrated && count > 0
              ? `${count} item${count === 1 ? "" : "s"} in your build list`
              : "Page " + activePage + " of " + totalPages}
          </span>
        </div>
      </div>

      {recent.length > 0 && (
        <div className="mt-8 border-b border-line pb-6">
          <p className="text-xs font-black uppercase tracking-[.24em] text-navy">Recently viewed</p>
          <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {recent.slice(0, 4).map((item) => (
              <ProductCard key={item.id} product={item} compact showCta={false} />
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {items.length === 0 && (
          <div className="col-span-full border-t-2 border-ink bg-white p-10 text-center">
            <p className="font-display text-xl font-bold">No products found</p>
            <p className="mt-2 text-sm text-muted">
              Try a different search term or browse another category.
            </p>
            {(maxPrice > 0 || inStock || sort !== "featured") && (
              <button
                onClick={() => {
                  chooseMaxPrice(0);
                  toggleInStock(false);
                  chooseSort("featured");
                }}
                className="mt-4 rounded-full border border-navy px-5 py-2 text-xs font-black text-navy transition hover:bg-mist"
              >
                Clear price &amp; stock filters
              </button>
            )}
          </div>
        )}
        {items.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>

      {hasMore && (
        <div className="mt-10 flex flex-col items-center gap-3">
          <button
            onClick={loadMore}
            className="inline-flex h-12 items-center gap-2 rounded-full bg-navy px-8 text-sm font-black text-white shadow-sm transition hover:bg-navy-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
          >
            See more <ChevronDown size={16} aria-hidden="true" />
          </button>
          <p className="text-xs text-muted">
            Showing {Math.min(total, activePage * PAGE_SIZE)} of {total} — page {activePage} of{" "}
            {totalPages}
          </p>
        </div>
      )}
      {!hasMore && total > 0 && (
        <p className="mt-10 text-center text-xs text-muted">You have seen all {total} listings.</p>
      )}
    </section>
  );
}
