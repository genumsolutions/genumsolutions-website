'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { formatNPR, products } from '../lib/catalog'

const categories = ['All', 'Robotics', 'Electronics', 'Learning', 'Components', 'AI + IoT', '3D Printing', 'Project Solutions']

export default function ProductCatalog() {
  const [category, setCategory] = useState('All')
  const [query, setQuery] = useState('')
  const [cartCount, setCartCount] = useState(0)
  const addToCart = (productId: string) => {
    const product = products.find((item) => item.id === productId)
    if (product?.productType === 'Project package') {
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
  const visibleProducts = useMemo(() => products.filter((product) => (category === 'All' || product.category === category) && `${product.name} ${product.note}`.toLowerCase().includes(query.toLowerCase())), [category, query])

  return <section className="mx-auto max-w-7xl px-5 py-12 lg:px-8 lg:py-16"><div className="flex flex-col gap-5 border-b border-line pb-6 lg:flex-row lg:items-center lg:justify-between"><div className="flex flex-wrap gap-2">{categories.map((item) => <button key={item} onClick={() => setCategory(item)} className={`rounded-full px-4 py-2 text-xs font-black ${category === item ? 'bg-ink text-white' : 'border border-line bg-white text-slate-600 hover:border-cobalt hover:text-cobalt'}`}>{item}</button>)}</div><label className="flex items-center gap-3 rounded-full border border-line bg-white px-4 py-2 text-sm text-slate-400"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full bg-transparent outline-none placeholder:text-slate-400 lg:w-52" placeholder="Search the shelf" /></label></div><div className="mt-5 flex items-center justify-between text-sm text-slate-500"><span>{visibleProducts.length} project{visibleProducts.length === 1 ? '' : 's'} found</span><span className="font-bold text-cobalt">{cartCount > 0 ? `${cartCount} item${cartCount > 1 ? 's' : ''} in your build list` : 'Free Kathmandu delivery over NPR 5,000'}</span></div><div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{visibleProducts.map((product) => <article key={product.id} className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm"><Link href={`/products/${product.id}`} aria-label={`View ${product.name}`} className={`flex h-48 items-center justify-center bg-gradient-to-br ${product.color}`}><div className="flex h-24 w-24 items-center justify-center rounded-[28px] border-4 border-ink bg-white/80 text-4xl shadow-xl">{product.category === 'Robotics' ? '◉' : product.category === 'Electronics' ? '⌁' : product.category === 'Learning' ? '✦' : product.category === '3D Printing' ? '▦' : '⚙'}</div></Link><div className="p-5"><p className="text-[10px] font-black uppercase tracking-widest text-cobalt">{product.category}</p><Link href={`/products/${product.id}`}><h2 className="mt-2 font-display text-xl font-bold hover:text-cobalt">{product.name}</h2></Link><p className="mt-1 text-sm text-slate-500">{product.note}</p><div className="mt-5 flex items-center justify-between"><span className="font-display text-lg font-bold">{product.priceLabel}</span><button onClick={() => addToCart(product.id)} className="rounded-full bg-cobalt px-4 py-2 text-xs font-black text-white hover:bg-ink">{product.productType === 'Project package' ? 'View scope ↗' : 'Add to cart +'}</button></div></div></article>)}</div>{visibleProducts.length === 0 && <div className="border border-dashed border-line py-16 text-center"><p className="font-display text-xl font-bold">No matching projects.</p><button onClick={() => { setCategory('All'); setQuery('') }} className="mt-3 text-sm font-bold text-cobalt underline underline-offset-4">Clear filters</button></div>}</section>
}
