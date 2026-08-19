'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { Product } from '../lib/catalog'
import { formatNPR } from '../lib/catalog'

export default function ProductDetailPro({ product }: { product: Product }) {
  const [quantity, setQuantity] = useState(1)
  const [added, setAdded] = useState(false)
  const isQuote = product.productType === 'Project package' || product.stock === 0

  function addToBuildList() {
    if (isQuote) {
      setAdded(true)
      return
    }
    const saved = JSON.parse(window.localStorage.getItem('genum-cart') || '[]') as { productId: string; quantity: number }[]
    const existing = saved.find((item) => item.productId === product.id)
    if (existing) existing.quantity = Math.min(existing.quantity + quantity, product.stock)
    else saved.push({ productId: product.id, quantity })
    window.localStorage.setItem('genum-cart', JSON.stringify(saved))
    setAdded(true)
  }

  return <main className="min-h-screen bg-mist"><div className="mx-auto max-w-7xl px-5 py-8 lg:px-8"><Link href="/products" className="text-sm font-bold text-cobalt">← Back to the shop</Link><div className="mt-8 grid gap-10 lg:grid-cols-[.9fr_1.1fr] lg:items-start"><div className={`flex aspect-square items-center justify-center rounded-3xl bg-gradient-to-br ${product.color}`}><div className="flex h-40 w-40 items-center justify-center rounded-[42px] border-4 border-ink bg-white/80 text-7xl shadow-2xl">{product.category === 'Robotics' ? '◉' : product.category === 'Electronics' ? '⌁' : product.category === 'Learning' ? '✦' : product.category === '3D Printing' ? '▦' : '⚙'}</div></div><div><p className="text-xs font-black uppercase tracking-[.24em] text-cobalt">{product.category} · {product.badge || product.productType}</p><h1 className="mt-3 font-display text-5xl font-bold leading-none tracking-[-.04em] text-ink">{product.name}</h1><p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">{product.description}</p><div className="mt-7 flex flex-wrap items-baseline gap-3"><span className="font-display text-3xl font-bold">{product.priceLabel}</span><span className="text-sm text-slate-500">{product.productType === 'Project package' ? 'indicative package' : 'per unit'}</span></div><div className="mt-6 flex flex-wrap items-center gap-3">{!isQuote && <div className="flex items-center rounded-full border border-line bg-white"><button onClick={() => setQuantity((value) => Math.max(1, value - 1))} className="h-11 w-11 text-lg font-bold">−</button><span className="w-8 text-center text-sm font-bold">{quantity}</span><button onClick={() => setQuantity((value) => Math.min(product.stock, value + 1))} className="h-11 w-11 text-lg font-bold">+</button></div>}<Link href={isQuote ? '/contact' : '/checkout'} onClick={isQuote ? undefined : addToBuildList} className="rounded-full bg-cobalt px-6 py-3.5 text-sm font-black text-white hover:bg-ink">{isQuote ? 'Request a scoped quote ↗' : added ? 'Added to build list ✓' : 'Add to build list'}</Link></div><div className="mt-8 grid gap-3 border-y border-line py-5 text-sm sm:grid-cols-2"><div><span className="block text-xs font-black uppercase tracking-widest text-cobalt">SKU</span><strong>{product.sku}</strong></div><div><span className="block text-xs font-black uppercase tracking-widest text-cobalt">Difficulty</span><strong>{product.difficulty}</strong></div><div><span className="block text-xs font-black uppercase tracking-widest text-cobalt">Audience</span><strong>{product.audience}</strong></div><div><span className="block text-xs font-black uppercase tracking-widest text-cobalt">Lead time</span><strong>{product.delivery}</strong></div><div className="sm:col-span-2"><span className="block text-xs font-black uppercase tracking-widest text-cobalt">Warranty / support</span><strong>{product.warranty}</strong></div></div><div className="mt-8"><h2 className="font-display text-2xl font-bold">Scope and specifications</h2><ul className="mt-4 grid gap-3 sm:grid-cols-2">{product.specs.map((spec) => <li key={spec} className="flex gap-3 text-sm text-slate-600"><span className="text-signal">✦</span>{spec}</li>)}</ul></div></div></div></div></main>
}
