'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { products as localProducts, type Product } from '../lib/catalog'
import { getProductMedia } from '../lib/product-media'

const componentCategories = ['All', 'Controllers & Boards', 'Motors & Motion', 'Sensors & Modules', 'Communication Modules', 'Displays & Interfaces', 'Power & Charging', 'Mechanical Parts', 'Connectors & Cables', 'Tools & Fabrication']
type CatalogScope = 'components' | 'cars' | 'projects'

export default function ProductCatalog({ scope = 'components', products = localProducts }: { scope?: CatalogScope; products?: Product[] }) {
  const [category, setCategory] = useState('All')
  const [query, setQuery] = useState('')
  const [cartCount, setCartCount] = useState(0)
  const scopedProducts = scope === 'cars' ? products.filter((product) => product.category === 'Robot Cars') : scope === 'projects' ? products.filter((product) => product.productType === 'Project package') : products.filter((product) => !['Robot Cars', '3D Printing Materials', 'Pre-packaged Kits'].includes(product.category) && product.productType !== 'Project package')
  const visibleProducts = useMemo(() => scopedProducts.filter((product) => (category === 'All' || product.category === category) && `${product.name} ${product.note} ${product.description}`.toLowerCase().includes(query.toLowerCase())), [category, query, scopedProducts])

  function addToCart(productId: string) {
    const product = products.find((item) => item.id === productId)
    if (!product || product.stock === 0 || product.productType === 'Project package') {
      window.location.href = `/products/${productId}`
      return
    }
    const saved = JSON.parse(window.localStorage.getItem('genum-cart') || '[]') as { productId: string; quantity: number }[]
    const existing = saved.find((item) => item.productId === productId)
    if (existing) existing.quantity += 1
    else saved.push({ productId, quantity: 1 })
    window.localStorage.setItem('genum-cart', JSON.stringify(saved))
    setCartCount((count) => count + 1)
  }

  const filters = scope === 'components' ? componentCategories : ['All']
  return <section className="mx-auto max-w-7xl px-5 py-12 lg:px-8 lg:py-16"><div className="flex flex-col gap-5 border-b border-line pb-6 lg:flex-row lg:items-center lg:justify-between"><div className="flex flex-wrap gap-2">{filters.map((item) => <button key={item} onClick={() => setCategory(item)} className={`rounded-full px-4 py-2 text-xs font-black ${category === item ? 'bg-ink text-white' : 'border border-line bg-white text-slate-600 hover:border-cobalt hover:text-cobalt'}`}>{item}</button>)}</div><label className="flex items-center gap-3 rounded-full border border-line bg-white px-4 py-2 text-sm text-slate-400"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full bg-transparent outline-none placeholder:text-slate-400 lg:w-52" placeholder="Search this section" /></label></div><div className="mt-5 flex items-center justify-between text-sm text-slate-500"><span>{visibleProducts.length} listing{visibleProducts.length === 1 ? '' : 's'} found</span><span className="font-bold text-cobalt">{cartCount > 0 ? `${cartCount} item${cartCount > 1 ? 's' : ''} in your build list` : scope === 'components' ? 'Components and materials only' : 'Quote by scope'}</span></div><div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{visibleProducts.map((product) => { const media = getProductMedia(product.category); const quoteOnly = product.stock === 0 || product.productType === 'Project package'; return <article key={product.id} className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm"><Link href={`/products/${product.id}`} aria-label={`View ${product.name}`} className="relative block h-48 overflow-hidden bg-ink"><img src={media.src} alt={media.alt} className="h-full w-full object-cover transition duration-500 hover:scale-105" loading="lazy" /><div className="absolute inset-0 bg-gradient-to-t from-ink/70 to-transparent" /><span className="absolute bottom-3 left-4 text-xs font-black uppercase tracking-widest text-white">{product.category}</span></Link><div className="p-5"><p className="text-[10px] font-black uppercase tracking-widest text-cobalt">{product.badge || product.productType}</p><h2 className="mt-2 font-display text-xl font-bold">{product.name}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{product.note}</p><div className="mt-5 flex items-center justify-between gap-3"><strong className="font-display text-lg">{product.priceLabel}</strong><button onClick={() => addToCart(product.id)} className="rounded-full bg-ink px-4 py-2 text-xs font-black text-white">{quoteOnly ? 'View' : 'Add'}</button></div></div></article> })}</div></section>
}
