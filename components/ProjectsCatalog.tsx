'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Check, ChevronDown, Search } from 'lucide-react'
import type { Product } from '../lib/catalog'
import { filterProducts, paginate, PAGE_SIZE } from '../lib/catalog'
import { getProductMedia } from '../lib/product-media'
import { useCart } from './cart-provider'
import { tabActive, tabBase, tabInactive } from '../lib/styles'

type ProjectTab = 'packages' | 'robot-cars'

export default function ProjectsCatalog({ products = [] }: { products?: Product[] }) {
  const [tab, setTab] = useState<ProjectTab>('packages')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const [page, setPage] = useState(1)
  const [addedId, setAddedId] = useState<string | null>(null)
  const { add, hydrated, count } = useCart()

  useEffect(() => {
    if (!addedId) return
    const timer = window.setTimeout(() => setAddedId(null), 1600)
    return () => window.clearTimeout(timer)
  }, [addedId])

  const packageProducts = useMemo(() => {
    return products.filter((p) => p.productType === 'Project package' && p.active !== false)
  }, [products])

  const robotCarProducts = useMemo(() => {
    return products.filter((p) => p.category === 'Robot Cars' && p.active !== false)
  }, [products])

  const activeProducts = tab === 'packages' ? packageProducts : robotCarProducts

  const categories = useMemo(() => {
    const present: string[] = []
    for (const p of activeProducts) if (!present.includes(p.category)) present.push(p.category)
    return present
  }, [activeProducts])

  const filtered = useMemo(
    () => filterProducts(activeProducts, category, query),
    [activeProducts, category, query],
  )

  const { items, totalPages, hasMore } = useMemo(() => paginate(filtered, page), [filtered, page])

  function changeTab(next: ProjectTab) {
    setTab(next)
    setQuery('')
    setCategory('All')
    setPage(1)
  }

  function addToCart(productId: string) {
    const product = products.find((item) => item.id === productId)
    if (!product || product.stock === 0) {
      window.location.href = `/products/${productId}`
      return
    }
    add(productId, 1)
    setAddedId(productId)
  }

  return (
    <section className="mx-auto max-w-7xl px-5 py-10 sm:py-12 lg:px-8 lg:py-16">
      <div role="tablist" aria-label="Project sections" className="flex gap-x-5 overflow-x-auto border-b border-line sm:gap-x-7">
        {([
          { key: 'packages' as const, label: 'Project Packages', count: packageProducts.length },
          { key: 'robot-cars' as const, label: 'Robot Car Projects', count: robotCarProducts.length },
        ]).map((item) => (
          <button
            key={item.key}
            role="tab"
            aria-selected={tab === item.key}
            onClick={() => changeTab(item.key)}
            className={`${tabBase} ${tab === item.key ? tabActive : tabInactive}`}
          >
            {item.label}
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${tab === item.key ? 'bg-navy-light text-navy' : 'bg-mist text-muted'}`}>{item.count}</span>
          </button>
        ))}
      </div>
      <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <label className="flex w-full max-w-xs items-center gap-3 rounded-full border border-line bg-white px-4 py-2 text-sm text-muted">
          <Search size={15} aria-hidden="true" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} className="w-full bg-transparent outline-none placeholder:text-muted" placeholder="Search this section" aria-label="Search projects" />
        </label>
        <div className="flex items-center justify-between gap-6 text-sm text-muted">
          <span>{filtered.length} listing{filtered.length === 1 ? '' : 's'}</span>
          <span aria-live="polite" className="font-bold text-navy">{hydrated && count > 0 ? `${count} item${count === 1 ? '' : 's'} in build list` : 'Quote by scope'}</span>
        </div>
      </div>

      {categories.length > 1 && (
        <div role="list" aria-label="Project categories" className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => { setCategory('All'); setPage(1) }}
            aria-pressed={category === 'All'}
            className={`min-h-[44px] whitespace-nowrap rounded-full px-4 py-2 text-xs font-bold transition ${category === 'All' ? 'bg-navy text-white shadow-sm' : 'border border-line bg-white text-muted hover:border-navy hover:text-navy'}`}
          >
            All <span className="opacity-70">({filtered.length})</span>
          </button>
          {categories.map((item) => {
            const count = filterProducts(activeProducts, item, query).length
            const active = category === item
            return (
              <button
                key={item}
                onClick={() => { setCategory(item); setPage(1) }}
                aria-pressed={active}
                className={`min-h-[44px] whitespace-nowrap rounded-full px-4 py-2 text-xs font-bold transition ${active ? 'bg-navy text-white shadow-sm' : 'border border-line bg-white text-muted hover:border-navy hover:text-navy'}`}
              >
                {item} <span className="opacity-70">({count})</span>
              </button>
            )
          })}
        </div>
      )}

      {tab === 'packages' && (
        <p className="mt-4 text-sm leading-6 text-slate-500">Named teaching and automation projects organized by scope.</p>
      )}
      {tab === 'robot-cars' && (
        <p className="mt-4 text-sm leading-6 text-slate-500">Assembled robot-car projects separated from components and materials.</p>
      )}

      <div className="mt-5 grid gap-5 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((product) => {
          const media = product.image
            ? { src: product.image, alt: product.name }
            : getProductMedia(product.category)
          const quoteOnly = product.stock === 0 || product.productType === 'Project package'

          return (
            <article
              key={product.id}
              className="flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-sm"
            >
              <Link href={`/products/${product.id}`} aria-label={`View ${product.name}`} className="relative block h-48 overflow-hidden bg-ink">
                <Image
                  src={media.src}
                  alt={media.alt}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover transition duration-500 hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ink/70 to-transparent" />
                <span className="absolute bottom-3 left-4 max-w-[calc(100%-2rem)] truncate text-xs font-black uppercase tracking-widest text-white">{product.category}</span>
              </Link>
              <div className="flex flex-1 flex-col p-5">
                <p className="truncate text-xs font-black uppercase tracking-widest text-navy">{tab === 'robot-cars' ? 'Robot Car' : product.productType}</p>
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
        {filtered.length === 0 && (
          <p className="col-span-full py-8 text-center text-sm text-slate-500">No projects found matching your filters.</p>
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
            Showing {Math.min(filtered.length, page * PAGE_SIZE)} of {filtered.length} — page {page} of {totalPages}
          </p>
        </div>
      )}
      {!hasMore && filtered.length > 0 && (
        <p className="mt-10 text-center text-xs text-muted">You have seen all {filtered.length} listings.</p>
      )}
    </section>
  )
}
