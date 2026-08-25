'use client'

import React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { formatNPR } from '../lib/catalog'
import type { Product } from '../lib/catalog'
import { useCart } from './cart-provider'

type ProjectTab = 'packages' | 'robot-cars'

function getProductMedia(category: string) {
  const mediaByCategory: Record<string, { src: string; alt: string }> = {
    Robotics: { src: '/media/robotics.jpg', alt: 'Small educational robot on a workbench' },
    Electronics: { src: '/media/electronics.jpg', alt: 'Electronic circuit board close-up' },
    Learning: { src: '/media/learning.jpg', alt: 'Robotics team working on a prototype' },
    Components: { src: '/media/components.jpg', alt: 'Motors and electronics components' },
    'AI + IoT': { src: '/media/ai-iot.jpg', alt: 'Team collaborating around connected technology' },
    '3D Printing': { src: '/media/printing.jpg', alt: 'Engineer working on a fabrication prototype' },
    'Project Solutions': { src: '/media/solutions.jpg', alt: 'Engineer working on a technology prototype' },
    'Robot Cars': { src: '/media/robot-cars.jpg', alt: 'Educational robot car platform on a workbench' },
  }
  return mediaByCategory[category] || mediaByCategory.Robotics
}

export default function ProjectsCatalog({ products = [] }: { products?: Product[] }) {
  const [tab, setTab] = React.useState<ProjectTab>('packages')
  const [query, setQuery] = React.useState('')
  const [addedId, setAddedId] = React.useState<string | null>(null)
  const { add, hydrated, count } = useCart()

  React.useEffect(() => {
    if (!addedId) return
    const timer = window.setTimeout(() => setAddedId(null), 1600)
    return () => window.clearTimeout(timer)
  }, [addedId])

  const packageProducts = React.useMemo(() => {
    return products.filter((p) => p.productType === 'Project package')
  }, [products])

  const robotCarProducts = React.useMemo(() => {
    return products.filter((p) => p.category === 'Robot Cars')
  }, [products])

  const activeProducts = tab === 'packages' ? packageProducts : robotCarProducts

  const visibleProducts = React.useMemo(() => {
    const needle = query.trim().toLowerCase()
    return activeProducts.filter((p) =>
      `${p.name} ${p.note} ${p.description}`.toLowerCase().includes(needle)
    )
  }, [query, activeProducts])

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
    <section className="mx-auto max-w-7xl px-5 py-12 lg:px-8 lg:py-16">
      <div className="flex flex-col gap-5 border-b border-line pb-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex flex-wrap gap-2">
            {([
              { key: 'packages' as const, label: 'Project Packages', count: packageProducts.length },
              { key: 'robot-cars' as const, label: 'Robot Car Projects', count: robotCarProducts.length },
            ]).map((item) => (
              <button
                key={item.key}
                onClick={() => { setTab(item.key); setQuery('') }}
                className={`rounded-full px-4 py-2 text-xs font-bold transition ${tab === item.key ? 'bg-cobalt text-white' : 'border border-line bg-white text-muted hover:border-cobalt hover:text-cobalt'}`}
              >
                {item.label} ({item.count})
              </button>
            ))}
          </div>
          <label className="mt-3 flex items-center gap-3 rounded-full border border-line bg-white px-4 py-2 text-sm text-muted">
            <span aria-hidden="true">⌕</span>
            <input value={query} onChange={(e) => setQuery(e.target.value)} className="w-full bg-transparent outline-none placeholder:text-muted lg:w-52" placeholder="Search this section" />
          </label>
        </div>
        <div className="mt-5 flex items-center justify-between text-sm text-muted">
          <span>{visibleProducts.length} listing{visibleProducts.length === 1 ? '' : 's'}</span>
          <span aria-live="polite" className="font-bold text-cobalt">{hydrated && count > 0 ? `${count} item${count === 1 ? '' : 's'} in build list` : 'Quote by scope'}</span>
        </div>
      </div>

      {tab === 'packages' && (
        <p className="mt-4 text-sm leading-6 text-slate-500">Named teaching and automation projects organized by scope. Each listing keeps its purpose, operating modes, components, sensors, and indicative NPR estimate together.</p>
      )}
      {tab === 'robot-cars' && (
        <p className="mt-4 text-sm leading-6 text-slate-500">Assembled robot-car projects separated from components and materials. Each car has a different control or teaching purpose.</p>
      )}

      <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {visibleProducts.map((product) => {
          const media = product.image
            ? { src: product.image, alt: product.name }
            : getProductMedia(product.category)
          const quoteOnly = product.stock === 0 || product.productType === 'Project package'

          return (
            <article
              key={product.id}
              className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm"
            >
              <Link href={`/products/${product.id}`} aria-label={`View ${product.name}`} className="relative block h-48 overflow-hidden bg-ink">
                <Image
                  src={media.src}
                  alt={media.alt}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width, 1024px) 50vw, 33vw"
                  className="object-cover transition duration-500 hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ink/70 to-transparent" />
                <span className="absolute bottom-3 left-4 text-xs font-black uppercase tracking-widest text-white">{product.category}</span>
              </Link>
              <div className="p-5">
                <p className="text-xs font-black uppercase tracking-widest text-cobalt">{tab === 'robot-cars' ? 'Robot Car' : product.productType}</p>
                <h2 className="mt-2 font-display text-xl font-bold leading-snug">{product.name}</h2>
                <p className="mt-2 min-h-12 text-sm leading-6 text-muted">{product.note || product.description?.split('. ')[0]}</p>
                <div className="mt-5 flex items-center justify-between gap-3">
                  <strong className="font-display text-lg">{product.priceLabel}</strong>
                  {quoteOnly ? (
                    <Link href={`/products/${product.id}`} className="rounded-full bg-cobalt px-4 py-2 text-xs font-black text-white transition hover:bg-cobalt-dark" aria-label={`View details for ${product.name}`}>View details</Link>
                  ) : (
                    <button
                      onClick={() => addToCart(product.id)}
                      className={`rounded-full px-4 py-2 text-xs font-black text-white transition ${addedId === product.id ? 'bg-emerald-600' : 'bg-cobalt hover:bg-cobalt-dark'}`}
                      aria-label={`${addedId === product.id ? 'Added' : 'Add'} ${product.name} to build list`}
                      aria-live="polite"
                    >
                      {addedId === product.id ? 'Added ✓' : 'Add'}
                    </button>
                  )}
                </div>
              </div>
            </article>
          )
        })}
        {visibleProducts.length === 0 && (
          <p className="col-span-full py-8 text-center text-sm text-slate-500">No projects found matching &ldquo;{query}&rdquo;.</p>
        )}
      </div>
    </section>
  )
}
