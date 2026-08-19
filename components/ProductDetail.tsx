'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { Product } from '../lib/catalog'
import { formatNPR } from '../lib/catalog'

export default function ProductDetail({ product }: { product: Product }) {
  const [quantity, setQuantity] = useState(1)
  const [added, setAdded] = useState(false)

  function addToBuildList() {
    if (product.stock === 0) {
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

  return <main className="min-h-screen bg-mist"><div className="mx-auto max-w-7xl px-5 py-8 lg:px-8"><Link href="/products" className="text-sm font-bold text-cobalt">← Back to the shop</Link><div className="mt-8 grid gap-10 lg:grid-cols-[.95fr_1.05fr] lg:items-start"><div className={`flex aspect-square items-center justify-center rounded-3xl bg-gradient-to-br ${product.color}`}><div className="flex h-40 w-40 items-center justify-center rounded-[42px] border-4 border-ink bg-white/80 text-7xl shadow-2xl">{product.category === 'Robotics' ? '◉' : product.category === 'Electronics' ? '⌁' : product.category === 'Learning' ? '✦' : '⚙'}</div></div><div><p className="text-xs font-black uppercase tracking-[.24em] text-cobalt">{product.category} · {product.badge || 'Workshop essential'}</p><h1 className="mt-3 font-display text-5xl font-bold leading-none tracking-[-.04em] text-ink">{product.name}</h1><p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">{product.description}</p><div className="mt-7 flex items-baseline gap-3"><span className="font-display text-3xl font-bold">{formatNPR(product.price)}</span><span className="text-sm text-slate-500">per kit</span></div><div className="mt-6 flex flex-wrap items-center gap-3"><div className="flex items-center rounded-full border border-line bg-white"><button onClick={() => setQuantity((value) => Math.max(1, value - 1))} className="h-11 w-11 text-lg font-bold">−</button><span className="w-8 text-center text-sm font-bold">{quantity}</span><button onClick={() => setQuantity((value) => Math.min(product.stock, value + 1))} className="h-11 w-11 text-lg font-bold">+</button></div><button onClick={addToBuildList} className="rounded-full bg-cobalt px-6 py-3.5 text-sm font-black text-white hover:bg-ink">{added ? 'Added to build list ✓' : 'Add to build list'}</button>{added && <Link href="/checkout" className="text-sm font-bold text-cobalt underline underline-offset-4">Go to checkout ↗</Link>}</div><div className="mt-8 border-y border-line py-5 text-sm"><p className="font-bold text-ink">{product.stock} kits ready to ship</p><p className="mt-1 text-slate-500">{product.delivery} · Kathmandu delivery available</p></div><div className="mt-8"><h2 className="font-display text-2xl font-bold">Inside the box</h2><ul className="mt-4 grid gap-3 sm:grid-cols-2">{product.specs.map((spec) => <li key={spec} className="flex gap-3 text-sm text-slate-600"><span className="text-signal">✦</span>{spec}</li>)}</ul></div></div></div></div></main>
}
