'use client'

import { useState } from 'react'
import type { Product, SiteContent } from '../lib/content-store'

type Props = { initialProducts: Product[]; initialContent: SiteContent }
const emptyProduct: Product = { id: '', name: '', category: 'Controllers & Boards', price: 0, priceLabel: 'Request quote', sku: '', productType: 'Retail kit', note: '', description: '', specs: [], audience: 'Students, schools, hobbyists, and makers', difficulty: 'Beginner', warranty: '7-day component replacement for manufacturing defects', stock: 0, delivery: 'Ships in 1-2 working days', color: 'from-[#dce8ff] to-[#7e9ff2]' }

export default function AdminPanel({ initialProducts, initialContent }: Props) {
  const [products, setProducts] = useState(initialProducts)
  const [product, setProduct] = useState<Product>(emptyProduct)
  const [content, setContent] = useState(initialContent)
  const [message, setMessage] = useState('')
  const [query, setQuery] = useState('')

  function updateProduct(key: keyof Product, value: string | number) { setProduct((current) => ({ ...current, [key]: value })) }
  async function saveProduct() {
    const payload = { ...product, specs: typeof product.specs === 'string' ? product.specs.split('\n').filter(Boolean) : product.specs, price: Number(product.price), stock: Number(product.stock) }
    const response = await fetch('/api/admin/products', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    if (!response.ok) { setMessage('Could not save product.'); return }
    setProducts((current) => [...current.filter((item) => item.id !== payload.id), payload].sort((a, b) => a.name.localeCompare(b.name)))
    setProduct(emptyProduct)
    setMessage('Product saved.')
  }
  async function saveContent() {
    const response = await fetch('/api/admin/content', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(content) })
    setMessage(response.ok ? 'Homepage content saved.' : 'Could not save homepage content.')
  }
  async function logout() { await fetch('/api/admin/logout', { method: 'POST' }); window.location.href = '/admin/login' }
  const shown = products.filter((item) => `${item.name} ${item.sku}`.toLowerCase().includes(query.toLowerCase()))
  return <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 lg:grid-cols-[1fr_1.3fr] lg:px-8"><section className="space-y-8"><div className="border-t-2 border-ink bg-white p-6"><div className="flex items-center justify-between"><h2 className="font-display text-2xl font-bold">Homepage content</h2><button onClick={saveContent} className="bg-cobalt px-4 py-2 text-xs font-black text-white">Save</button></div><label className="mt-6 block text-sm font-bold">Hero title<input value={content.homeTitle} onChange={(event) => setContent({ ...content, homeTitle: event.target.value })} className="mt-2 w-full border border-line px-3 py-2" /></label><label className="mt-4 block text-sm font-bold">Hero description<textarea value={content.homeBody} onChange={(event) => setContent({ ...content, homeBody: event.target.value })} rows={4} className="mt-2 w-full border border-line px-3 py-2" /></label></div><div className="border-t-2 border-ink bg-white p-6"><h2 className="font-display text-2xl font-bold">{product.id ? 'Edit product' : 'Add product'}</h2><div className="mt-5 grid gap-4 sm:grid-cols-2">{(['id', 'name', 'category', 'sku', 'price', 'priceLabel', 'stock', 'note', 'description'] as const).map((key) => <label key={key} className="text-sm font-bold">{key}<input value={String(product[key])} onChange={(event) => updateProduct(key, ['price', 'stock'].includes(key) ? Number(event.target.value) : event.target.value)} className="mt-2 w-full border border-line px-3 py-2" /></label>)}<label className="text-sm font-bold sm:col-span-2">Specs, one per line<textarea value={product.specs.join('\n')} onChange={(event) => updateProduct('specs', event.target.value)} rows={4} className="mt-2 w-full border border-line px-3 py-2" /></label></div><div className="mt-5 flex gap-3"><button onClick={saveProduct} className="bg-signal px-5 py-3 text-sm font-black text-ink">Save product</button>{product.id && <button onClick={() => setProduct(emptyProduct)} className="border border-line px-5 py-3 text-sm font-bold">New product</button>}</div></div>{message && <p className="text-sm font-bold text-cobalt">{message}</p>}<button onClick={logout} className="text-sm font-bold text-slate-500 underline">Sign out</button></section><section className="border-t-2 border-ink bg-white p-6"><div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="font-display text-2xl font-bold">Products</h2><p className="mt-1 text-sm text-slate-500">{products.length} listings available on the storefront.</p></div><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products" className="border border-line px-3 py-2 text-sm" /></div><div className="mt-6 divide-y divide-line">{shown.slice(0, 80).map((item) => <button key={item.id} onClick={() => setProduct(item)} className="flex w-full items-center justify-between gap-4 py-4 text-left hover:text-cobalt"><span><strong className="block text-sm">{item.name}</strong><span className="text-xs text-slate-500">{item.sku} · {item.category}</span></span><span className="text-xs font-bold">Edit</span></button>)}</div></section></div>
}
