'use client'

import { FormEvent, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { formatNPR } from '../lib/catalog'
import type { Product, SiteContent } from '../lib/content-store'

type Props = { initialProducts: Product[]; initialContent: SiteContent }
const emptyProduct: Product = { id: '', name: '', category: 'Controllers & Boards', price: 0, priceLabel: 'Request quote', sku: '', productType: 'Retail kit', note: '', description: '', specs: [], audience: 'Students, schools, hobbyists, and makers', difficulty: 'Beginner', warranty: '7-day component replacement for manufacturing defects', stock: 0, delivery: 'Ships in 1-2 working days', color: 'from-[#dce8ff] to-[#7e9ff2]', image: '' }
const fields = ['id', 'name', 'category', 'sku', 'price', 'priceLabel', 'stock', 'note', 'description'] as const

type Order = { id: string; items: { name: string; quantity: number; price: number }[]; totalNpr: number; status: string; provider: string; customerName: string; email: string; address: string; createdAt: string }
const STATUSES = ['pending', 'paid', 'fulfilled', 'cancelled']

export default function AdminPanel({ initialProducts, initialContent }: Props) {
  const [products, setProducts] = useState(initialProducts)
  const [product, setProduct] = useState<Product>(emptyProduct)
  const [content, setContent] = useState(initialContent)
  const [message, setMessage] = useState('')
  const [query, setQuery] = useState('')
  const [uploading, setUploading] = useState(false)
  const [orders, setOrders] = useState<Order[]>([])
  const [showOrders, setShowOrders] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!showOrders || orders.length) return
    fetch('/api/admin/orders').then((response) => (response.ok ? response.json() : { orders: [] })).then((data) => setOrders(data.orders || [])).catch(() => undefined)
  }, [showOrders, orders.length])

  function updateProduct(key: keyof Product, value: string | number | string[]) {
    setProduct((current) => ({ ...current, [key]: value }))
  }

  async function saveProduct(event?: FormEvent) {
    event?.preventDefault()
    if (!product.id || !product.name) { setMessage('Give the product at least an id (like arduino-uno) and a name.'); return }
    const payload = { ...product, id: product.id.trim().toLowerCase().replace(/\s+/g, '-'), price: Number(product.price), stock: Number(product.stock), specs: typeof product.specs === 'string' ? String(product.specs).split('\n').filter(Boolean) : product.specs }
    const response = await fetch('/api/admin/products', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) { setMessage(result.error || 'Could not save product.'); return }
    setProducts((current) => [...current.filter((item) => item.id !== payload.id), payload].sort((a, b) => a.name.localeCompare(b.name)))
    setProduct(emptyProduct)
    setMessage('Product saved. It is live on the site now.')
  }

  async function removeProduct(id: string) {
    if (!window.confirm(`Delete ${id}? This removes it from the live site.`)) return
    const response = await fetch(`/api/admin/products?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    if (response.ok) { setProducts((current) => current.filter((item) => item.id !== id)); setMessage('Product deleted.') } else { setMessage('Could not delete the product.') }
  }

  async function uploadImage(file: File) {
    setUploading(true); setMessage('')
    const form = new FormData()
    form.append('file', file)
    const response = await fetch('/api/admin/upload', { method: 'POST', body: form })
    const result = await response.json().catch(() => ({}))
    if (response.ok && result.url) { setProduct((current) => ({ ...current, image: result.url })); setMessage('Image uploaded.') }
    else setMessage(result.error || 'Upload failed.')
    setUploading(false)
  }

  async function saveContent() {
    const response = await fetch('/api/admin/content', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(content) })
    setMessage(response.ok ? 'Homepage content saved.' : 'Could not save homepage content.')
  }

  async function setOrderStatus(id: string, status: string) {
    const response = await fetch('/api/admin/orders', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) })
    if (response.ok) setOrders((current) => current.map((order) => order.id === id ? { ...order, status } : order))
    else setMessage('Could not update the order.')
  }

  async function logout() { await fetch('/api/auth/logout', { method: 'POST' }); window.location.href = '/login' }
  const shown = products.filter((item) => `${item.name} ${item.sku} ${item.id}`.toLowerCase().includes(query.toLowerCase()))

  return (
    <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 lg:grid-cols-[1fr_1.3fr] lg:px-8">
      <section className="space-y-8">
        <div className="border-t-2 border-ink bg-white p-6">
          <div className="flex items-center justify-between"><h2 className="font-display text-2xl font-bold">Homepage content</h2><button onClick={saveContent} className="bg-cobalt px-4 py-2 text-xs font-black text-white">Save</button></div>
          <label className="mt-6 block text-sm font-bold">Hero title<input value={content.homeTitle} onChange={(event) => setContent({ ...content, homeTitle: event.target.value })} className="mt-2 w-full border border-line px-3 py-2" /></label>
          <label className="mt-4 block text-sm font-bold">Hero description<textarea value={content.homeBody} onChange={(event) => setContent({ ...content, homeBody: event.target.value })} rows={4} className="mt-2 w-full border border-line px-3 py-2" /></label>
        </div>

        <div className="border-t-2 border-ink bg-white p-6">
          <button onClick={() => setShowOrders((value) => !value)} className="w-full text-left"><h2 className="font-display text-2xl font-bold">Customer orders {showOrders ? '▾' : '▸'}</h2></button>
          {showOrders && (orders.length === 0 ? <p className="mt-3 text-sm text-slate-500">No orders yet.</p> : (
            <div className="mt-4 space-y-3">
              {orders.map((order) => (
                <div key={order.id} className="border border-line p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div><p className="text-sm font-black">#{order.id.slice(0, 8).toUpperCase()} · {formatNPR(order.totalNpr)}</p><p className="text-xs text-slate-500">{order.customerName} · {order.email}</p><p className="text-xs text-slate-400">{order.address}</p></div>
                    <select value={order.status} onChange={(event) => setOrderStatus(order.id, event.target.value)} className="border border-line px-2 py-1 text-xs font-bold">{STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select>
                  </div>
                  <ul className="mt-2 text-xs leading-5 text-slate-600">{order.items.map((item) => <li key={`${order.id}-${item.name}`}>{item.quantity} × {item.name}</li>)}</ul>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="border-t-2 border-ink bg-white p-6">
          <h2 className="font-display text-xl font-bold">Products ({products.length})</h2>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products" className="mt-3 w-full border border-line px-3 py-2 text-sm" />
          <div className="mt-3 max-h-96 divide-y divide-line overflow-y-auto">
            {shown.map((item) => <div key={item.id} className="flex items-center justify-between gap-2 py-2"><span className="truncate text-sm"><strong>{item.name}</strong> <span className="text-slate-400">{item.sku}</span></span><span className="flex shrink-0 gap-2"><button onClick={() => setProduct(item)} className="text-xs font-bold text-cobalt underline">Edit</button><button onClick={() => removeProduct(item.id)} className="text-xs font-bold text-red-600 underline">Delete</button></span></div>)}
          </div>
        </div>
      </section>

      <section className="space-y-6">
        {message && <p className="border-l-4 border-cobalt bg-white px-4 py-3 text-sm font-bold text-ink">{message}</p>}
        <form onSubmit={saveProduct} className="border-t-2 border-ink bg-white p-6">
          <h2 className="font-display text-2xl font-bold">{products.some((item) => item.id === product.id) ? `Edit ${product.id}` : 'Add a new product'}</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {fields.map((key) => <label key={key} className="text-sm font-bold">{key}<input value={String(product[key] ?? '')} onChange={(event) => updateProduct(key, ['price', 'stock'].includes(key) ? Number(event.target.value) : event.target.value)} className="mt-2 w-full border border-line px-3 py-2" /></label>)}
            <label className="text-sm font-bold sm:col-span-2">Specs, one per line<textarea value={Array.isArray(product.specs) ? product.specs.join('\n') : String(product.specs)} onChange={(event) => updateProduct('specs', event.target.value.split('\n'))} rows={4} className="mt-2 w-full border border-line px-3 py-2" /></label>
            <div className="sm:col-span-2">
              <p className="text-sm font-bold">Product image</p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                {product.image && <Image src={product.image} alt="" width={64} height={64} className="rounded object-cover" />}
                <input value={product.image || ''} onChange={(event) => updateProduct('image', event.target.value)} placeholder="https://... or upload below" className="min-w-0 flex-1 border border-line px-3 py-2 text-sm" />
                <input ref={fileInput} type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadImage(file); event.currentTarget.value = '' }} className="hidden" />
                <button type="button" disabled={uploading} onClick={() => fileInput.current?.click()} className="bg-cobalt px-4 py-2 text-xs font-black text-white disabled:opacity-60">{uploading ? 'Uploading...' : 'Upload'}</button>
              </div>
            </div>
          </div>
          <div className="mt-5 flex gap-3">
            <button type="submit" disabled={uploading} className="bg-signal px-5 py-3 text-sm font-black text-ink">Save product</button>
            {product.id && <button type="button" onClick={() => setProduct(emptyProduct)} className="border border-line px-5 py-3 text-sm font-black text-ink">New product</button>}
          </div>
        </form>
      </section>
    </div>
  )
}
