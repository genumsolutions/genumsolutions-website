'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { Product } from '../lib/catalog'
import { getProductMedia } from '../lib/product-media'

export default function ProductDetailPro({ product }: { product: Product }) {
  const [quantity, setQuantity] = useState(1)
  const [added, setAdded] = useState(false)
  const isQuote = product.productType === 'Project package' || product.stock === 0
  const media = product.image ? { src: product.image, alt: product.name } : getProductMedia(product.category)

  function addToBuildList() {
    if (isQuote) { setAdded(true); return }
    const saved = JSON.parse(window.localStorage.getItem('genum-cart') || '[]') as { productId: string; quantity: number }[]
    const existing = saved.find((item) => item.productId === product.id)
    if (existing) existing.quantity = Math.min(existing.quantity + quantity, product.stock)
    else saved.push({ productId: product.id, quantity })
    window.localStorage.setItem('genum-cart', JSON.stringify(saved))
    void fetch('/api/cart', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cart: saved }) })
    setAdded(true)
  }

  return <main className="min-h-screen bg-mist"><div className="mx-auto max-w-7xl px-5 py-8 lg:px-8"><Link href="/products" className="text-sm font-bold text-cobalt">← Back to the shop</Link><div className="mt-8 grid gap-10 lg:grid-cols-[.9fr_1.1fr] lg:items-start"><div className="relative aspect-square overflow-hidden rounded-3xl bg-ink"><img src={media.src} alt={media.alt} className="h-full w-full object-cover" /></div><div><p className="text-xs font-black uppercase tracking-[.24em] text-cobalt">{product.category} · {product.badge || product.productType}</p><h1 className="mt-3 font-display text-5xl font-bold leading-none tracking-[-.04em] text-ink">{product.name}</h1><p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">{product.description}</p><div className="mt-7 flex flex-wrap items-baseline gap-3"><span className="font-display text-3xl font-bold">{product.priceLabel}</span><span className="text-sm text-slate-500">{product.productType === 'Project package' ? 'indicative package' : 'per unit'}</span></div><div className="mt-6 flex flex-wrap items-center gap-3">{!isQuote && <div className="flex items-center rounded-full border border-line bg-white"><button onClick={() => setQuantity((value) => Math.max(1, value - 1))} className="h-11 w-11 text-lg font-bold">−</button><span className="w-8 text-center text-sm font-bold">{quantity}</span><button onClick={() => setQuantity((value) => Math.min(product.stock, value + 1))} className="h-11 w-11 text-lg font-bold">+</button></div>}<Link href={isQuote ? '/contact' : '/checkout'} onClick={isQuote ? undefined : addToBuildList} className="rounded-full bg-cobalt px-6 py-3.5 text-sm font-black text-white hover:bg-ink">{isQuote ? 'Request a scoped quote ↗' : added ? 'Added to build list' : 'Add to build list'}</Link></div><div className="mt-10 grid gap-4 border-y border-line py-6 sm:grid-cols-2"><div><p className="text-xs font-black uppercase tracking-widest text-cobalt">Audience</p><p className="mt-2 text-sm leading-6 text-slate-600">{product.audience}</p></div><div><p className="text-xs font-black uppercase tracking-widest text-cobalt">Delivery</p><p className="mt-2 text-sm leading-6 text-slate-600">{product.delivery}</p></div><div><p className="text-xs font-black uppercase tracking-widest text-cobalt">Difficulty</p><p className="mt-2 text-sm leading-6 text-slate-600">{product.difficulty}</p></div><div><p className="text-xs font-black uppercase tracking-widest text-cobalt">Warranty</p><p className="mt-2 text-sm leading-6 text-slate-600">{product.warranty}</p></div></div></div></div><section className="mt-16 max-w-3xl"><p className="text-xs font-black uppercase tracking-[.24em] text-cobalt">Included scope</p><h2 className="mt-2 font-display text-3xl font-bold">What this listing covers.</h2><ul className="mt-6 grid gap-3 sm:grid-cols-2">{product.specs.map((spec) => <li key={spec} className="border-l-2 border-signal bg-white px-4 py-3 text-sm text-slate-600">{spec}</li>)}</ul></section></div></main>
}
