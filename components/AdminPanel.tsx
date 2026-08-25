'use client'

import { FormEvent, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { formatNPR } from '../lib/catalog'
import type { Product, SiteContent } from '../lib/content-store'

type Props = { initialProducts: Product[]; initialContent: SiteContent }
const emptyProduct: Product = { id: '', name: '', category: 'Controllers & Boards', price: 0, priceLabel: 'Request quote', sku: '', productType: 'Retail kit', note: '', description: '', specs: [], audience: 'Students, schools, hobbyists, and makers', difficulty: 'Beginner', warranty: '7-day component replacement for manufacturing defects', stock: 0, delivery: 'Ships in 1-2 working days', color: 'from-[#dce8ff] to-[#7e9ff2]', image: '' }
const fields = ['id', 'name', 'category', 'sku', 'price', 'priceLabel', 'stock', 'note', 'description'] as const

type Order = { id: string; items: { name: string; quantity: number; price: number }[]; totalNpr: number; status: string; provider: string; customerName: string; email: string; address: string; createdAt: string }
type OrderPage = { orders: Order[]; total: number; page: number; totalPages: number }
type ManagedUser = { id: string; email: string; name: string; phone: string; address: string; role: string; createdAt: string; lastSignInAt: string | null }
type UserPage = { users: ManagedUser[]; page: number; hasMore: boolean }

const STATUSES = ['pending', 'paid', 'fulfilled', 'cancelled']
const TABS = ['Products', 'Orders', 'Users', 'Content'] as const
type Tab = typeof TABS[number]
const PAGE_SIZE = 10

function Pager({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (page: number) => void }) {
  if (totalPages <= 1) return null
  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-between text-sm font-bold">
      <button onClick={() => onPage(page - 1)} disabled={page <= 1} className="border border-line px-3 py-1.5 transition hover:border-cobalt hover:text-cobalt disabled:cursor-not-allowed disabled:opacity-40">← Prev</button>
      <span aria-live="polite" className="text-slate-500">Page {page} of {totalPages}</span>
      <button onClick={() => onPage(page + 1)} disabled={page >= totalPages} className="border border-line px-3 py-1.5 transition hover:border-cobalt hover:text-cobalt disabled:cursor-not-allowed disabled:opacity-40">Next →</button>
    </nav>
  )
}

export default function AdminPanel({ initialProducts, initialContent }: Props) {
  const [tab, setTab] = useState<Tab>('Products')
  const [products, setProducts] = useState(initialProducts)
  const [product, setProduct] = useState<Product>(emptyProduct)
  const [content, setContent] = useState(initialContent)
  const [message, setMessage] = useState('')
  const [query, setQuery] = useState('')
  const [productPage, setProductPage] = useState(1)
  const [uploading, setUploading] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  // Orders state (server paginated)
  const [orderData, setOrderData] = useState<OrderPage>({ orders: [], total: 0, page: 1, totalPages: 1 })
  const [ordersLoaded, setOrdersLoaded] = useState(false)
  const [orderQuery, setOrderQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  // Users state (server paginated)
  const [userData, setUserData] = useState<UserPage>({ users: [], page: 1, hasMore: false })
  const [usersLoaded, setUsersLoaded] = useState(false)
  const [userQuery, setUserQuery] = useState('')

  useEffect(() => {
    setProductPage(1)
  }, [query])

  async function loadOrders(page: number) {
    setOrdersLoaded(false)
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
      if (orderQuery.trim()) params.set('q', orderQuery.trim())
      if (statusFilter) params.set('status', statusFilter)
      const response = await fetch(`/api/admin/orders?${params}`)
      if (response.ok) setOrderData(await response.json())
    } finally {
      setOrdersLoaded(true)
    }
  }

  async function loadUsers(page: number) {
    setUsersLoaded(false)
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
      if (userQuery.trim()) params.set('q', userQuery.trim())
      const response = await fetch(`/api/admin/users?${params}`)
      if (response.ok) setUserData(await response.json())
    } finally {
      setUsersLoaded(true)
    }
  }

  function openOrders() {
    setTab('Orders')
    if (!ordersLoaded) void loadOrders(1)
  }

  function openUsers() {
    setTab('Users')
    if (!usersLoaded) void loadUsers(1)
  }

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
    if (response.ok) setOrderData((current) => ({ ...current, orders: current.orders.map((order) => order.id === id ? { ...order, status } : order) }))
    else setMessage('Could not update the order.')
  }

  async function setUserRole(userId: string, role: 'admin' | 'customer') {
    const verb = role === 'admin' ? 'grant ADMIN access to' : 'revoke admin access from'
    if (!window.confirm(`Are you sure you want to ${verb} this user?`)) return
    const response = await fetch('/api/admin/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, role }) })
    if (response.ok) {
      setUserData((current) => ({ ...current, users: current.users.map((user) => user.id === userId ? { ...user, role } : user) }))
      setMessage(role === 'admin' ? 'Admin access granted.' : 'Admin access revoked.')
    } else setMessage('Could not update the role.')
  }

  const filteredProducts = products.filter((item) => `${item.name} ${item.sku} ${item.id}`.toLowerCase().includes(query.toLowerCase()))
  const productTotalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE))
  const shownProducts = filteredProducts.slice((productPage - 1) * PAGE_SIZE, productPage * PAGE_SIZE)

  return (
    <div className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
      <div role="tablist" aria-label="Admin sections" className="flex flex-wrap gap-2 border-b border-line pb-4">
        {TABS.map((name) => (
          <button
            key={name}
            role="tab"
            aria-selected={tab === name}
            onClick={() => (name === 'Orders' ? openOrders() : name === 'Users' ? openUsers() : setTab(name))}
            className={`rounded-full px-5 py-2.5 text-sm font-black transition ${tab === name ? 'bg-ink text-white' : 'border border-line bg-white text-slate-600 hover:border-cobalt hover:text-cobalt'}`}
          >
            {name}
          </button>
        ))}
      </div>

      {message && <p role="status" className="mt-4 border-l-4 border-cobalt bg-white px-4 py-3 text-sm font-bold text-ink">{message}</p>}

      {tab === 'Products' && (
        <div className="mt-8 grid gap-8 xl:grid-cols-[1fr_1.3fr]">
          <section aria-label="Product list" className="space-y-6">
            <div className="border-t-2 border-ink bg-white p-6">
              <h2 className="font-display text-xl font-bold">Products ({filteredProducts.length})</h2>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name, SKU, or id" aria-label="Search products" className="mt-3 w-full border border-line px-3 py-2 text-sm" />
              <div className="mt-3 divide-y divide-line">
                {shownProducts.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-2 py-2">
                    <span className="truncate text-sm"><strong>{item.name}</strong> <span className="text-slate-400">{item.sku}</span></span>
                    <span className="flex shrink-0 gap-2">
                      <button onClick={() => { setProduct(item); setTab('Products'); window.scrollTo({ top: 0, behavior: 'smooth' }) }} className="text-xs font-bold text-cobalt underline">Edit</button>
                      <button onClick={() => removeProduct(item.id)} className="text-xs font-bold text-red-600 underline">Delete</button>
                    </span>
                  </div>
                ))}
                {shownProducts.length === 0 && <p className="py-3 text-sm text-slate-500">No products match “{query}”.</p>}
              </div>
              <Pager page={productPage} totalPages={productTotalPages} onPage={setProductPage} />
            </div>
          </section>

          <section aria-label="Product editor">
            <form onSubmit={saveProduct} className="border-t-2 border-ink bg-white p-6">
              <h2 className="font-display text-2xl font-bold">{products.some((item) => item.id === product.id) ? `Edit ${product.id}` : 'Add a new product'}</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {fields.map((key) => <label key={key} className="text-sm font-bold capitalize">{key}<input value={String(product[key] ?? '')} onChange={(event) => updateProduct(key, ['price', 'stock'].includes(key) ? Number(event.target.value) : event.target.value)} className="mt-2 w-full border border-line px-3 py-2" /></label>)}
                <label className="text-sm font-bold sm:col-span-2">Specs, one per line<textarea value={Array.isArray(product.specs) ? product.specs.join('\n') : String(product.specs)} onChange={(event) => updateProduct('specs', event.target.value.split('\n'))} rows={4} className="mt-2 w-full border border-line px-3 py-2" /></label>
                <div className="sm:col-span-2">
                  <p className="text-sm font-bold">Product image</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    {product.image && <Image src={product.image} alt="" width={64} height={64} className="rounded object-cover" />}
                    <input value={product.image || ''} onChange={(event) => updateProduct('image', event.target.value)} placeholder="https://... or upload below" aria-label="Product image URL" className="min-w-0 flex-1 border border-line px-3 py-2 text-sm" />
                    <input ref={fileInput} type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadImage(file); event.currentTarget.value = '' }} className="hidden" />
                    <button type="button" disabled={uploading} onClick={() => fileInput.current?.click()} className="bg-cobalt px-4 py-2 text-xs font-black text-white disabled:opacity-60">{uploading ? 'Uploading...' : 'Upload'}</button>
                  </div>
                </div>
              </div>
              <div className="mt-5 flex gap-3">
                <button type="submit" disabled={uploading} className="bg-signal px-5 py-3 text-sm font-black text-ink transition hover:bg-yellow-500 disabled:opacity-60">Save product</button>
                {product.id && <button type="button" onClick={() => setProduct(emptyProduct)} className="border border-line px-5 py-3 text-sm font-black text-ink transition hover:border-cobalt">New product</button>}
              </div>
            </form>
          </section>
        </div>
      )}

      {tab === 'Orders' && (
        <section aria-label="Customer orders" className="mt-8 space-y-4">
          <div className="flex flex-wrap items-end gap-3 border-t-2 border-ink bg-white p-6">
            <h2 className="font-display text-xl font-bold">Customer orders</h2>
            <label className="ml-auto text-sm font-bold text-slate-500">Search buyer
              <input value={orderQuery} onChange={(event) => setOrderQuery(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && void loadOrders(1)} placeholder="email or name" aria-label="Search orders by buyer" className="ml-2 w-48 border border-line px-3 py-2 text-sm" />
            </label>
            <label className="text-sm font-bold text-slate-500">Status
              <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); }} aria-label="Filter orders by status" className="ml-2 border border-line px-3 py-2 text-sm font-bold">
                <option value="">All</option>
                {STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </label>
            <button onClick={() => void loadOrders(1)} className="bg-cobalt px-4 py-2 text-xs font-black text-white transition hover:bg-blue-800">Apply</button>
          </div>
          {!ordersLoaded ? <p className="text-sm text-slate-500" role="status">Loading orders…</p> : orderData.orders.length === 0 ? <p className="text-sm text-slate-500">No orders found.</p> : (
            <>
              <ul className="space-y-3">
                {orderData.orders.map((order) => (
                  <li key={order.id} className="border border-line bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div><p className="text-sm font-black">#{order.id.slice(0, 8).toUpperCase()} · {formatNPR(order.totalNpr)}</p><p className="text-xs text-slate-500">{order.customerName} · {order.email}</p><p className="text-xs text-slate-400">{order.address}</p></div>
                      <select value={order.status} onChange={(event) => setOrderStatus(order.id, event.target.value)} aria-label={`Set status for order ${order.id.slice(0, 8)}`} className="border border-line px-2 py-1 text-xs font-bold">{STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select>
                    </div>
                    <ul className="mt-2 text-xs leading-5 text-slate-600">{order.items.map((item) => <li key={`${order.id}-${item.name}`}>{item.quantity} × {item.name}</li>)}</ul>
                  </li>
                ))}
              </ul>
              <Pager page={orderData.page} totalPages={orderData.totalPages} onPage={(page) => void loadOrders(page)} />
              <p className="text-xs text-slate-400">{orderData.total} total order{orderData.total === 1 ? '' : 's'}</p>
            </>
          )}
        </section>
      )}

      {tab === 'Users' && (
        <section aria-label="User management" className="mt-8 space-y-4">
          <div className="flex flex-wrap items-end gap-3 border-t-2 border-ink bg-white p-6">
            <h2 className="font-display text-xl font-bold">Users</h2>
            <label className="ml-auto text-sm font-bold text-slate-500">Search
              <input value={userQuery} onChange={(event) => setUserQuery(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && void loadUsers(1)} placeholder="email or name" aria-label="Search users" className="ml-2 w-56 border border-line px-3 py-2 text-sm" />
            </label>
            <button onClick={() => void loadUsers(1)} className="bg-cobalt px-4 py-2 text-xs font-black text-white transition hover:bg-blue-800">Apply</button>
          </div>
          {!usersLoaded ? <p className="text-sm text-slate-500" role="status">Loading users…</p> : userData.users.length === 0 ? <p className="text-sm text-slate-500">No users found.</p> : (
            <>
              <ul className="space-y-3">
                {userData.users.map((user) => (
                  <li key={user.id} className="flex flex-wrap items-center justify-between gap-3 border border-line bg-white p-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{user.name || '—'} <span className="font-normal text-slate-500">· {user.email}</span></p>
                      <p className="text-xs text-slate-400">Joined {new Date(user.createdAt).toLocaleDateString()}{user.lastSignInAt ? ` · Last seen ${new Date(user.lastSignInAt).toLocaleDateString()}` : ''}</p>
                      <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${user.role === 'admin' ? 'bg-signal text-ink' : 'bg-sky text-cobalt'}`}>{user.role}</span>
                    </div>
                    <span className="flex shrink-0 gap-2">
                      {user.role === 'admin'
                        ? <button onClick={() => setUserRole(user.id, 'customer')} className="border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600 transition hover:bg-red-50">Revoke admin</button>
                        : <button onClick={() => setUserRole(user.id, 'admin')} className="border border-line px-3 py-1.5 text-xs font-bold text-cobalt transition hover:border-cobalt">Make admin</button>}
                    </span>
                  </li>
                ))}
              </ul>
              <Pager page={userData.page} totalPages={userData.page + (userData.hasMore ? 1 : 0)} onPage={(page) => void loadUsers(page)} />
            </>
          )}
        </section>
      )}

      {tab === 'Content' && (
        <section aria-label="Homepage content" className="mt-8 border-t-2 border-ink bg-white p-6">
          <div className="flex items-center justify-between"><h2 className="font-display text-2xl font-bold">Homepage content</h2><button onClick={saveContent} className="bg-cobalt px-4 py-2 text-xs font-black text-white transition hover:bg-blue-800">Save</button></div>
          <label className="mt-6 block text-sm font-bold">Hero title<input value={content.homeTitle} onChange={(event) => setContent({ ...content, homeTitle: event.target.value })} className="mt-2 w-full border border-line px-3 py-2" /></label>
          <label className="mt-4 block text-sm font-bold">Hero description<textarea value={content.homeBody} onChange={(event) => setContent({ ...content, homeBody: event.target.value })} rows={4} className="mt-2 w-full border border-line px-3 py-2" /></label>
        </section>
      )}
    </div>
  )
}
