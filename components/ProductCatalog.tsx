'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Check, ChevronDown, Search } from 'lucide-react'
import type { Product } from '../lib/catalog'
import { applyScope, filterProducts, paginate, PAGE_SIZE } from '../lib/catalog'
import { getProductMedia } from '../lib/product-media'
import { useCart } from './cart-provider'

export default function ProductCatalog({
  scope = 'components',
  products = [],
  initialPage = 1,
  initialQuery = '',
  initialCategory = 'All',
}: {
  scope?: string
  products?: Product[]
  initialPage?: number
  initialQuery?: string
  initialCategory?: string
}) {
  const router = useRouter()
  const [category, setCategory] = useState(initialCategory)
  const [query, setQuery] = useState(initialQuery)
  const [page, setPage] = useState(Math.max(1, initialPage))
  const [addedId, setAddedId] = useState<string | null>(null)
  const { add, count, hydrated } = useCart()

  useEffect(() => {
    if (!addedId) return
    const timer = window.setTimeout(() => setAddedId(null), 1600)
    return () => window.clearTimeout(timer)
  }, [addedId])

  const scopedProducts = useMemo(() => applyScope(products, scope).filter((product) => product.active !== false), [products, scope])

  const categories = useMemo(() => {
    const present: string[] = []
    for (const p of scopedProducts) {
      if (!present.includes(p.category)) present.push(p.category)
    }
    return present
  }, [scopedProducts])

  const filtered = useMemo(
    () => filterProducts(scopedProducts, category, query),
    [scopedProducts, category, query],
  )

  const { items, page: activePage, total, totalPages, hasMore } = useMemo(
    () => paginate(filtered, page),
    [filtered, page],
  )

  // Keep the URL in sync so /products?page=2&q=...&category=... are real,
  // shareable sub-pages (this is what the app's WebView mirrors too).
  function syncUrl(next: { category?: string; query?: string; page?: number }) {
    const params = new URLSearchParams()
    const cat = next.category ?? category
    const q = next.query ?? query
    if (cat !== 'All') params.set('category', cat)
    if (q.trim()) params.set('q', q.trim())
    if (next.page && next.page > 1) params.set('page', String(next.page))
    const qs = params.toString()
    router.replace(qs ? `/products?${qs}` : '/products', { scroll: false })
  }

  function chooseCategory(next: string) {
    setCategory(next)
    setPage(1)
    syncUrl({ category: next, page: 1 })
  }

  function handleQueryChange(value: string) {
    setQuery(value)
    setPage(1)
    syncUrl({ query: value, page: 1 })
  }

  function loadMore() {
    const next = page + 1
    setPage(next)
    syncUrl({ page: next })
  }

  function addToCart(productId: string) {
    const product = products.find((item) => item.id === productId)
    if (!product || product.stock === 0 || product.productType === 'Project package') {
      window.location.href = `/products/${productId}`
      return
    }
    add(productId, 1)
    setAddedId(productId)
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
            <button onClick={() => handleQueryChange('')} aria-label="Clear search" className="text-xs font-bold text-navy underline-offset-2 hover:underline">
              Clear
            </button>
          )}
        </label>

        <div role="list" aria-label="Product categories" className="mt-4 flex flex-wrap gap-2">
          {categories.map((item) => {
            const count = filterProducts(scopedProducts, item, query).length
            const active = category === item
            return (
              <button
                key={item}
                onClick={() => chooseCategory(item)}
                aria-pressed={active}
                className={`min-h-[44px] whitespace-nowrap rounded-full px-4 py-2 text-xs font-bold transition ${
                  active
                    ? 'bg-navy text-white shadow-sm'
                    : 'border border-line bg-white text-muted hover:border-navy hover:text-navy'
                }`}
              >
                {item} <span className={`opacity-70 ${active ? 'text-white' : ''}`}>({count})</span>
              </button>
            )
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
          <span aria-live="polite">
            {total} listing{total === 1 ? '' : 's'} found
            {category !== 'All' && <> in <strong className="text-navy">{category}</strong></>}
          </span>
          <span className="font-bold text-navy">
            {hydrated && count > 0 ? `${count} item${count === 1 ? '' : 's'} in your build list` : 'Page ' + activePage + ' of ' + totalPages}
          </span>
        </div>
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {items.length === 0 && (
          <div className="col-span-full border-t-2 border-ink bg-white p-10 text-center">
            <p className="font-display text-xl font-bold">No products found</p>
            <p className="mt-2 text-sm text-muted">Try a different search term or browse another category.</p>
          </div>
        )}
        {items.map((product) => {
          const media = product.image
            ? { src: product.image, alt: product.name }
            : getProductMedia(product.category)
          const quoteOnly = product.stock === 0 || product.productType === 'Project package'

          return (
            <article key={product.id} className="flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
              <Link
                href={`/products/${product.id}`}
                aria-label={`View ${product.name}`}
                className="block h-48 overflow-hidden bg-ink"
              >
                <Image
                  src={media.src}
                  alt={media.alt}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover"
                />
              </Link>
              <div className="flex flex-1 flex-col p-5">
                <p className="truncate text-xs font-black uppercase tracking-widest text-navy">{product.badge || product.productType}</p>
                <h2 className="mt-2 line-clamp-2 font-display text-xl font-bold leading-snug">{product.name}</h2>
                <p className="mt-2 line-clamp-2 flex-1 text-sm leading-6 text-muted">{product.note || product.description?.split('. ')[0]}</p>
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                  <strong className="font-display text-lg">{product.priceLabel}</strong>
                  {quoteOnly ? (
                    <Link href={`/products/${product.id}`} className="rounded-full bg-navy px-4 py-2 text-xs font-black text-white transition hover:bg-navy-dark" aria-label={`View details for ${product.name}`}>View details</Link>
                  ) : (
                    <button
                      onClick={() => addToCart(product.id)}
                      className={`rounded-full px-4 py-2 text-xs font-black text-white transition ${addedId === product.id ? 'bg-emerald-600' : 'bg-navy hover:bg-navy-dark'}`}
                      aria-label={`${addedId === product.id ? 'Added' : 'Add'} ${product.name} to build list`}
                      aria-live="polite"
                    >
                      {addedId === product.id ? <span className="inline-flex items-center gap-1.5"><Check size={13} aria-hidden="true" /> Added</span> : 'Add'}
                    </button>
                  )}
                </div>
              </div>
            </article>
          )
        })}
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
            Showing {Math.min(total, activePage * PAGE_SIZE)} of {total} — page {activePage} of {totalPages}
          </p>
        </div>
      )}
      {!hasMore && total > 0 && (
        <p className="mt-10 text-center text-xs text-muted">You have seen all {total} listings.</p>
      )}
    </section>
  )
}
