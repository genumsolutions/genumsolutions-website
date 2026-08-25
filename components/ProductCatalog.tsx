'use client'

import React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { formatNPR } from '../lib/catalog'
import type { Product } from '../lib/catalog'
import { useCart } from './cart-provider'

export default function ProductCatalog({ scope = 'components', products = [] }: { scope?: string; products?: Product[] }) {
  const [category, setCategory] = React.useState('All')
  const [query, setQuery] = React.useState('')
  const [addedId, setAddedId] = React.useState<string | null>(null)
  const { add, count, hydrated } = useCart()

  React.useEffect(() => {
    if (!addedId) return
    const timer = window.setTimeout(() => setAddedId(null), 1600)
    return () => window.clearTimeout(timer)
  }, [addedId])

  const scopedProducts = React.useMemo(() => {
    if (scope === 'cars') {
      return products.filter((product) => product.category === 'Robot Cars')
    }
    if (scope === 'projects') {
      return products.filter((product) => product.productType === 'Project package')
    }
    return products.filter((product) =>
      !['Robot Cars', '3D Printing Materials', 'Pre-packaged Kits'].includes(product.category) &&
      product.productType !== 'Project package'
    )
  }, [scope, products])

  const visibleProducts = React.useMemo(() => {
    const needle = query.trim().toLowerCase()
    return scopedProducts.filter((product) =>
      `${product.name} ${product.note} ${product.description}`.toLowerCase().includes(needle)
    )
  }, [query, scopedProducts])

  function addToCart(productId: string) {
    const product = products.find((item) => item.id === productId)
    if (!product || product.stock === 0 || product.productType === 'Project package') {
      window.location.href = `/products/${productId}`
      return
    }
    add(productId, 1)
    setAddedId(productId)
  }

  const filters = scope === 'components'
    ? ['All', 'Controllers & Boards', 'Motors & Motion', 'Sensors & Modules', 'Communication Modules', 'Displays & Interfaces', 'Power & Charging', 'Mechanical Parts', 'Connectors & Cables', 'Tools & Fabrication']
    : ['All']

  return (
    <section className="mx-auto max-w-7xl px-5 py-12 lg:px-8 lg:py-16">
      <div className="flex flex-col gap-5 border-b border-line pb-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex flex-wrap gap-2">
            {filters.map((item) => (
              <button
                key={item}
                onClick={() => setCategory(item)}
                className={`rounded-full px-4 py-2 text-xs font-bold transition ${category === item ? 'bg-cobalt text-white' : 'border border-line bg-white text-muted hover:border-cobalt hover:text-cobalt'}`}
              >
                {item}{item !== 'All' && ` · ${products.filter((p) => p.category === item).length}`}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-3 rounded-full border border-line bg-white px-4 py-2 text-sm text-muted">
            <span aria-hidden="true">⌕</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full bg-transparent outline-none placeholder:text-muted lg:w-52" placeholder="Search this section" />
          </label>
        </div>
        <div className="mt-5 flex items-center justify-between text-sm text-muted">
          <span>{visibleProducts.length} listing{visibleProducts.length === 1 ? '' : 's'} found</span>
          <span aria-live="polite" className="font-bold text-cobalt">{hydrated && count > 0 ? `${count} item${count === 1 ? '' : 's'} in your build list` : scope === 'components' ? 'Components and materials only' : 'Quote by scope'}</span>
        </div>
      </div>

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
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover transition duration-500 hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ink/70 to-transparent" />
                <span className="absolute bottom-3 left-4 text-xs font-black uppercase tracking-widest text-white">{product.category}</span>
              </Link>
              <div className="p-5">
                <p className="text-xs font-black uppercase tracking-widest text-cobalt">{product.badge || product.productType}</p>
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
      </div>
    </section>
  )
}

function getProductMedia(category: string) {
  const mediaByCategory: Record<string, { src: string; alt: string }> = {
    Robotics: { src: '/media/robotics.jpg', alt: 'Small educational robot on a workbench' },
    Electronics: { src: '/media/electronics.jpg', alt: 'Electronic circuit board close-up' },
    Learning: { src: '/media/learning.jpg', alt: 'Robotics team working on a prototype' },
    Components: { src: '/media/components.jpg', alt: 'Motors and electronics components' },
    'AI + IoT': { src: '/media/ai-iot.jpg', alt: 'Team collaborating around connected technology' },
    '3D Printing': { src: '/media/printing.jpg', alt: 'Engineer working on a fabrication prototype' },
    'Project Solutions': { src: '/media/solutions.jpg', alt: 'Engineer working on a technology prototype' },
    'Controllers & Boards': { src: '/media/controllers.jpg', alt: 'Development boards and electronic components on a workbench' },
    'Motors & Motion': { src: '/media/motors.jpg', alt: 'Small motors and motion components' },
    'Sensors & Modules': { src: '/media/sensors.jpg', alt: 'Electronic sensor modules and circuit board' },
    'Power & Charging': { src: '/media/power.jpg', alt: 'Power and electronic components on a circuit board' },
    'Mechanical Parts': { src: '/media/mechanical.jpg', alt: 'Mechanical workshop parts and tools' },
    'Connectors & Cables': { src: '/media/cables.jpg', alt: 'Organized electronic cables and connectors' },
    'Tools & Fabrication': { src: '/media/tools.jpg', alt: 'Workshop tools for electronics and fabrication' },
    'Pre-packaged Kits': { src: '/media/kits.jpg', alt: 'Students building a robotics project kit' },
    '3D Printing Materials': { src: '/media/printing-materials.jpg', alt: '3D printer filament and printed prototype parts' },
    'Robot Cars': { src: '/media/robot-cars.jpg', alt: 'Educational robot car platform on a workbench' },
    'Communication Modules': { src: '/media/communication.jpg', alt: 'Wireless communication and electronics modules' },
    'Displays & Interfaces': { src: '/media/displays.jpg', alt: 'Small electronic display and controller components' },
  }
  return mediaByCategory[category] || mediaByCategory.Robotics
}