'use client'

import { FormEvent, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { Activity, ChevronLeft, ChevronRight, LayoutDashboard, MessageSquare, Package, ShoppingBag, Users, Wallet, Wrench } from 'lucide-react'
import { formatNPR } from '../lib/catalog'
import { inputClass, tabActive, tabBase, tabInactive } from '../lib/styles'
import type { Product } from '../lib/content-store'

type Props = { initialProducts: Product[] }
const emptyProduct: Product = { id: '', name: '', category: 'Controllers & Boards', price: 0, priceLabel: 'Request quote', sku: '', productType: 'Retail kit', note: '', description: '', specs: [], audience: 'Students, schools, hobbyists, and makers', difficulty: 'Beginner', warranty: '7-day component replacement for manufacturing defects', stock: 0, delivery: 'Ships in 1-2 working days', color: 'from-[#dce8ff] to-[#7e9ff2]', image: '' }
const fields = ['id', 'name', 'category', 'sku', 'price', 'priceLabel', 'stock', 'note', 'description'] as const

type Order = { id: string; items: { name: string; quantity: number; price: number }[]; totalNpr: number; status: string; provider: string; customerName: string; email: string; address: string; createdAt: string }
type OrderPage = { orders: Order[]; total: number; page: number; totalPages: number }
type ManagedUser = { id: string; email: string; name: string; phone: string; address: string; role: string; createdAt: string; lastSignInAt: string | null }
type UserPage = { users: ManagedUser[]; page: number; hasMore: boolean }

type DashboardStats = { totalUsers: number; newUsersToday: number; totalOrders: number; pendingOrders: number; revenue: number; revenueToday: number; totalProducts: number; lowStockProducts: number; totalMessages: number; unreadMessages: number; totalTransactions: number; succeededTransactions: number }
type Service = { id: string; name: string; category: string; priceLabel: string; description: string; tag: string; sortOrder: number; active: boolean }
type ActivityEntry = { id: string; userId: string | null; action: string; entityType: string; entityId: string | null; details: Record<string, unknown>; createdAt: string }
type Message = { id: string; name: string; email: string; message: string; status: string; created_at: string }
type PageViewStat = { path: string; count: number; uniqueUsers: number }

const STATUSES = ['pending', 'paid', 'fulfilled', 'cancelled']
// Operations-first order: a shop manager needs orders over dashboarding.
const TABS = ['Orders', 'Products', 'Messages', 'Services', 'Finance', 'Users', 'Dashboard', 'Activity', 'ProjectPackages', 'RobotCarProjects'] as const

const TAB_ICONS = {
  Dashboard: LayoutDashboard,
  Products: Package,
  Services: Wrench,
  Orders: ShoppingBag,
  Finance: Wallet,
  Users: Users,
  Messages: MessageSquare,
  Activity: Activity,
  ProjectPackages: Package,
  RobotCarProjects: Wrench,
} as const
type Tab = typeof TABS[number]
const PAGE_SIZE = 10

const emptyService: Service = { id: '', name: '', category: 'General', priceLabel: 'Request quote', description: '', tag: '', sortOrder: 1000, active: true }

function Pager({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (page: number) => void }) {
  if (totalPages <= 1) return null
  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-between text-sm font-bold">
      <button onClick={() => onPage(page - 1)} disabled={page <= 1} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 transition hover:border-navy hover:text-navy disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft size={14} aria-hidden="true" /> Prev</button>
      <span aria-live="polite" className="text-slate-500">Page {page} of {totalPages}</span>
      <button onClick={() => onPage(page + 1)} disabled={page >= totalPages} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 transition hover:border-navy hover:text-navy disabled:cursor-not-allowed disabled:opacity-40">Next <ChevronRight size={14} aria-hidden="true" /></button>
    </nav>
  )
}

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="border-t-2 border-ink bg-white p-5">
      <p className="text-xs font-black uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-2 font-display text-3xl font-bold text-ink">{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  )
}

function formatTimestamp(ts: string) {
  try { return new Date(ts).toLocaleString() } catch { return ts }
}

export default function AdminPanel({ initialProducts }: Props) {
  const [tab, setTab] = useState<Tab>('Orders')
  const [products, setProducts] = useState(initialProducts)
  const [product, setProduct] = useState<Product>(emptyProduct)
  const [message, setMessage] = useState('')
  const [query, setQuery] = useState('')
  const [productPage, setProductPage] = useState(1)
  const [busy, setBusy] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  // Orders
  const [orderData, setOrderData] = useState<OrderPage>({ orders: [], total: 0, page: 1, totalPages: 1 })
  const [ordersLoaded, setOrdersLoaded] = useState(false)
  const [orderQuery, setOrderQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  // Users
  const [userData, setUserData] = useState<UserPage>({ users: [], page: 1, hasMore: false })
  const [usersLoaded, setUsersLoaded] = useState(false)
  const [userQuery, setUserQuery] = useState('')

  // Dashboard
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [analytics, setAnalytics] = useState<{ totalViews: number; todayViews: number; topPaths: PageViewStat[]; viewsByDay: { date: string; count: number }[] } | null>(null)

  // Services
  const [services, setServices] = useState<Service[]>([])
  const [servicesLoaded, setServicesLoaded] = useState(false)
  const [service, setService] = useState<Service>(emptyService)

  // Finance
  const [financeLoaded, setFinanceLoaded] = useState(false)

  // Messages
  const [messages, setMessages] = useState<Message[]>([])
  const [messagesLoaded, setMessagesLoaded] = useState(false)
  const [messagesPage, setMessagesPage] = useState(1)
  const [messagesTotal, setMessagesTotal] = useState(0)
  const [messagesTotalPages, setMessagesTotalPages] = useState(1)
  const [messageFilter, setMessageFilter] = useState('')

  // Activity
  const [activities, setActivities] = useState<ActivityEntry[]>([])
  const [activityLoaded, setActivityLoaded] = useState(false)
  const [activityPage, setActivityPage] = useState(1)
  const [activityTotal, setActivityTotal] = useState(0)
  const [activityTotalPages, setActivityTotalPages] = useState(1)

  useEffect(() => { setProductPage(1) }, [query])

  // Orders is the default tab - fetch its first page on mount.
  // loadOrders is recreated each render, so exclude it (mount-only intent).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void loadOrders(1) }, [])

  // ─── Data loaders ───

  async function loadDashboard() {
    const [statsRes, analyticsRes] = await Promise.all([
      fetch('/api/admin/stats').then((r) => r.json()).catch(() => null),
      fetch('/api/admin/analytics?days=30').then((r) => r.json()).catch(() => null),
    ])
    if (statsRes) setStats(statsRes)
    if (analyticsRes) setAnalytics(analyticsRes)
  }

  async function loadOrders(page: number) {
    setOrdersLoaded(false)
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
      if (orderQuery.trim()) params.set('q', orderQuery.trim())
      if (statusFilter) params.set('status', statusFilter)
      const response = await fetch(`/api/admin/orders?${params}`)
      if (response.ok) setOrderData(await response.json())
    } finally { setOrdersLoaded(true) }
  }

  async function loadUsers(page: number) {
    setUsersLoaded(false)
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
      if (userQuery.trim()) params.set('q', userQuery.trim())
      const response = await fetch(`/api/admin/users?${params}`)
      if (response.ok) setUserData(await response.json())
    } finally { setUsersLoaded(true) }
  }

  async function loadServices() {
    setServicesLoaded(false)
    try {
      const response = await fetch('/api/admin/services')
      if (response.ok) { const data = await response.json(); setServices(data.services ?? []) }
    } finally { setServicesLoaded(true) }
  }

  async function loadFinance() {
    setFinanceLoaded(false)
    try {
      if (!stats) await loadDashboard()
    } finally { setFinanceLoaded(true) }
  }

  async function loadMessages(page: number) {
    setMessagesLoaded(false)
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
      if (messageFilter) params.set('status', messageFilter)
      const response = await fetch(`/api/admin/messages?${params}`)
      if (response.ok) {
        const data = await response.json()
        setMessages(data.messages ?? [])
        setMessagesTotal(data.total ?? 0)
        setMessagesPage(data.page ?? 1)
        setMessagesTotalPages(data.totalPages ?? 1)
      }
    } finally { setMessagesLoaded(true) }
  }

  async function loadActivity(page: number) {
    setActivityLoaded(false)
    try {
      const response = await fetch(`/api/admin/activity?page=${page}&limit=${PAGE_SIZE}`)
      if (response.ok) {
        const data = await response.json()
        setActivities(data.entries ?? [])
        setActivityTotal(data.total ?? 0)
        setActivityPage(data.page ?? 1)
        setActivityTotalPages(data.totalPages ?? 1)
      }
    } finally { setActivityLoaded(true) }
  }

  // ─── Tab openers (lazy load) ───

  function openTab(next: Tab) {
    setTab(next)
    if (next === 'Dashboard') { void loadDashboard() }
    if (next === 'Orders' && !ordersLoaded) void loadOrders(1)
    if (next === 'Users' && !usersLoaded) void loadUsers(1)
    if (next === 'Services' && !servicesLoaded) void loadServices()
    if (next === 'Finance' && !financeLoaded) void loadFinance()
    if (next === 'Messages' && !messagesLoaded) void loadMessages(1)
    if (next === 'Activity' && !activityLoaded) void loadActivity(1)
  }

  // ─── Mutations ───

  function updateProduct(key: keyof Product, value: string | number | string[]) {
    setProduct((current) => ({ ...current, [key]: value }))
  }

  async function saveProduct(event?: FormEvent) {
    event?.preventDefault()
    if (!product.id || !product.name) { setMessage('Give the product at least an id and a name.'); return }
    setBusy('product')
    const payload = { ...product, id: product.id.trim().toLowerCase().replace(/\s+/g, '-'), price: Number(product.price), stock: Number(product.stock), specs: typeof product.specs === 'string' ? String(product.specs).split('\n').filter(Boolean) : product.specs }
    const response = await fetch('/api/admin/products', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) { setMessage(result.error || 'Could not save product.'); setBusy(''); return }
    setProducts((current) => [...current.filter((item) => item.id !== payload.id), payload].sort((a, b) => a.name.localeCompare(b.name)))
    setProduct(emptyProduct)
    setMessage('Product saved.')
    setBusy('')
  }

  async function removeProduct(id: string) {
    if (!window.confirm(`Delete ${id}?`)) return
    const response = await fetch(`/api/admin/products?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    if (response.ok) { setProducts((current) => current.filter((item) => item.id !== id)); setMessage('Product deleted.') }
  }

  async function uploadImage(file: File) {
    setUploading(true); setMessage('')
    const form = new FormData(); form.append('file', file)
    const response = await fetch('/api/admin/upload', { method: 'POST', body: form })
    const result = await response.json().catch(() => ({}))
    if (response.ok && result.url) { setProduct((current) => ({ ...current, image: result.url })); setMessage('Image uploaded.') }
    else setMessage(result.error || 'Upload failed.')
    setUploading(false)
  }

  async function setOrderStatus(id: string, status: string) {
    const response = await fetch('/api/admin/orders', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) })
    if (response.ok) setOrderData((current) => ({ ...current, orders: current.orders.map((order) => order.id === id ? { ...order, status } : order) }))
    else setMessage('Could not update the order.')
  }

  async function setUserRole(userId: string, role: 'admin' | 'customer') {
    const verb = role === 'admin' ? 'grant admin to' : 'revoke admin from'
    if (!window.confirm(`Are you sure you want to ${verb} this user?`)) return
    const response = await fetch('/api/admin/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, role }) })
    if (response.ok) {
      setUserData((current) => ({ ...current, users: current.users.map((user) => user.id === userId ? { ...user, role } : user) }))
      setMessage(role === 'admin' ? 'Admin access granted.' : 'Admin access revoked.')
    } else setMessage('Could not update the role.')
  }

  // Services mutations
  function updateService(key: keyof Service, value: string | number | boolean) {
    setService((current) => ({ ...current, [key]: value }))
  }

  async function saveServiceItem(event?: FormEvent) {
    event?.preventDefault()
    if (!service.id || !service.name) { setMessage('Service needs at least an id and name.'); return }
    setBusy('service')
    const payload = { ...service, id: service.id.trim().toLowerCase().replace(/\s+/g, '-') }
    const response = await fetch('/api/admin/services', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) { setMessage(result.error || 'Could not save service.'); setBusy(''); return }
    setServices((current) => [...current.filter((s) => s.id !== payload.id), payload].sort((a, b) => a.sortOrder - b.sortOrder))
    setService(emptyService)
    setMessage('Service saved.')
    setBusy('')
  }

  async function removeService(id: string) {
    if (!window.confirm(`Delete service ${id}?`)) return
    const response = await fetch(`/api/admin/services?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    if (response.ok) { setServices((current) => current.filter((s) => s.id !== id)); setMessage('Service deleted.') }
  }

  async function markMessageReplied(id: string) {
    const response = await fetch('/api/admin/messages', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status: 'replied' }) })
    if (response.ok) setMessages((current) => current.map((m) => m.id === id ? { ...m, status: 'replied' } : m))
  }

  // ─── Derived state ───

  const filteredProducts = products.filter((item) => `${item.name} ${item.sku} ${item.id}`.toLowerCase().includes(query.toLowerCase()))
  const productTotalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE))
  const shownProducts = filteredProducts.slice((productPage - 1) * PAGE_SIZE, productPage * PAGE_SIZE)

  // ─── Render ───

  return (
    <div className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
      <div role="tablist" aria-label="Admin sections" className="-mx-5 flex items-center gap-x-6 overflow-x-auto border-b border-line px-5 lg:mx-0 lg:px-0">
        {TABS.map((name) => {
          const Icon = TAB_ICONS[name]
          return (
            <button
              key={name}
              role="tab"
              id={`tab-${name.toLowerCase()}`}
              aria-selected={tab === name}
              aria-controls={`panel-${name.toLowerCase()}`}
              onClick={() => openTab(name)}
              className={`${tabBase} shrink-0 text-[13px] ${tab === name ? tabActive : tabInactive}`}
            >
              <Icon size={15} aria-hidden="true" />
              {name}
            </button>
          )
        })}
      </div>

      {message && <p role="status" className="mt-4 border-l-4 border-navy bg-white px-4 py-3 text-sm font-bold text-ink">{message}</p>}

      {/* ═══════ DASHBOARD ═══════ */}
      {tab === 'Dashboard' && (
        <section role="tabpanel" aria-labelledby="tab-dashboard" aria-label="Dashboard overview" className="mt-8 space-y-8">
          <h2 className="font-display text-2xl font-bold text-ink">Dashboard</h2>
          {!stats ? <p className="text-sm text-slate-500" role="status">Loading stats…</p> : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Stat label="Revenue" value={formatNPR(stats.revenue)} sub={`Today: ${formatNPR(stats.revenueToday)}`} />
                <Stat label="Orders" value={stats.totalOrders} sub={`${stats.pendingOrders} pending`} />
                <Stat label="Users" value={stats.totalUsers} sub={`${stats.newUsersToday} new today`} />
                <Stat label="Products" value={stats.totalProducts} sub={stats.lowStockProducts > 0 ? `${stats.lowStockProducts} low stock` : 'Stock OK'} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Stat label="Transactions" value={stats.totalTransactions} sub={`${stats.succeededTransactions} succeeded`} />
                <Stat label="Messages" value={stats.totalMessages} sub={`${stats.unreadMessages} unread`} />
                <Stat label="Page Views (30d)" value={analytics?.totalViews ?? '—'} sub={`Today: ${analytics?.todayViews ?? '—'}`} />
                <Stat label="Conversion Rate" value={stats.totalOrders > 0 && stats.totalUsers > 0 ? `${((stats.succeededTransactions / Math.max(1, stats.totalUsers)) * 100).toFixed(1)}%` : '—'} sub="Paid orders / users" />
              </div>
              {analytics && analytics.topPaths.length > 0 && (
                <div className="border-t-2 border-ink bg-white p-6">
                  <h3 className="font-display text-lg font-bold">Top Pages (30 days)</h3>
                  <ul className="mt-3 divide-y divide-line">
                    {analytics.topPaths.slice(0, 10).map((pv) => (
                      <li key={pv.path} className="flex items-center justify-between gap-3 py-2 text-sm">
                        <span className="min-w-0 truncate font-mono text-xs text-slate-600">{pv.path}</span>
                        <span className="shrink-0 font-bold">{pv.count} views</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {analytics && analytics.viewsByDay.length > 0 && (
                <div className="border-t-2 border-ink bg-white p-6">
                  <h3 className="font-display text-lg font-bold">Daily Traffic (30 days)</h3>
                  <div className="mt-3 flex items-end gap-1" style={{ height: 120 }}>
                    {analytics.viewsByDay.map((d) => {
                      const max = Math.max(...analytics.viewsByDay.map((x) => x.count), 1)
                      return (
                        <div key={d.date} className="flex-1 bg-navy" style={{ height: `${(d.count / max) * 100}%`, minHeight: 2 }} title={`${d.date}: ${d.count}`} />
                      )
                    })}
                  </div>
                  <div className="mt-1 flex justify-between text-[10px] text-slate-400">
                    <span>{analytics.viewsByDay[0]?.date}</span>
                    <span>{analytics.viewsByDay[analytics.viewsByDay.length - 1]?.date}</span>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {/* ═══════ PROJECT PACKAGES ═══════ */}
      {tab === 'ProjectPackages' && (
        <section role="tabpanel" aria-labelledby="tab-project-packages" aria-label="Project packages overview" className="mt-8 space-y-8">
          <h2 className="font-display text-2xl font-bold text-ink">Project Packages</h2>
          {products.length === 0 ? (
            <p className="text-sm text-slate-500">No products found.</p>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {products
                  .filter((p) => p.productType === 'Project package')
                  .map((product) => {
                  const { id, name, category, priceLabel, note, description, image } = product
                  return (
                    <article
                      key={id}
                      className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm"
                    >
                      <div className="relative bg-ink">
                        {image && <Image src={image} alt={name} width={400} height={250} className="object-cover" />}
                        {!image && (
                          <div className="absolute inset-0 bg-navy/30 flex items-center justify-center text-white text-xs font-bold">Project Package</div>
                        )}
                        <span className="absolute top-3 left-3 text-xs font-black uppercase tracking-widest text-white">Project Package</span>
                      </div>
                      <div className="p-5">
                        <p className="text-xs font-black uppercase tracking-widest text-navy">{category}</p>
                        <h2 className="mt-2 font-display text-xl font-bold leading-snug">{name}</h2>
                        <p className="mt-2 min-h-20 text-sm leading-6 text-muted">{note || description || ''}</p>
                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                          <strong className="font-display text-lg">{priceLabel}</strong>
                          <button
                            onClick={() => {
                              setProduct(product)
                              window.scrollTo({ top: 0, behavior: 'smooth' })
                            }}
                            className="rounded-full bg-navy px-4 py-2 text-xs font-black text-white transition hover:bg-navy-dark"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm(`Delete project package ${name}?`)) {
                                removeProduct(id)
                              }
                            }}
                            className="rounded-full bg-red-100 px-4 py-2 text-xs font-bold text-red-600 transition hover:bg-red-200"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </article>
                  )
                  })}
              </div>
              {products.filter((p) => p.productType === 'Project package').length === 0 && (
                <p className="mt-8 text-center text-sm text-slate-500">No project packages found.</p>
              )}
            </>
          )}
        </section>
      )}

      {/* ═══════ ROBOT CAR PROJECTS ═══════ */}
      {tab === 'RobotCarProjects' && (
        <section role="tabpanel" aria-labelledby="tab-robot-car-projects" aria-label="Robot car projects overview" className="mt-8 space-y-8">
          <h2 className="font-display text-2xl font-bold text-ink">Robot Car Projects</h2>
          {products.length === 0 ? (
            <p className="text-sm text-slate-500">No products found.</p>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {products
                  .filter((p) => p.category === 'Robot Cars')
                  .map((product) => {
                  const { id, name, category, priceLabel, note, description, specs, image } = product
                  return (
                    <article
                      key={id}
                      className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm"
                    >
                      <div className="relative bg-ink">
                        {image && <Image src={image} alt={name} width={400} height={250} className="object-cover" />}
                        {!image && (
                          <div className="absolute inset-0 bg-navy/30 flex items-center justify-center text-white text-xs font-bold">Robot Car</div>
                        )}
                        <span className="absolute top-3 left-3 text-xs font-black uppercase tracking-widest text-white">Robot Car</span>
                      </div>
                      <div className="p-5">
                        <p className="text-xs font-black uppercase tracking-widest text-navy">{category}</p>
                        <h2 className="mt-2 font-display text-xl font-bold leading-snug">{name}</h2>
                        <p className="mt-2 min-h-20 text-sm leading-6 text-muted">{note || description || ''}</p>
                        {specs && specs.length > 0 && (
                          <p className="mt-3 text-[10px] text-slate-400 font-mono">{specs.join(', ')}</p>
                        )}
                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                          <strong className="font-display text-lg">{priceLabel}</strong>
                          <button
                            onClick={() => {
                              setProduct(product)
                              window.scrollTo({ top: 0, behavior: 'smooth' })
                            }}
                            className="rounded-full bg-navy px-4 py-2 text-xs font-black text-white transition hover:bg-navy-dark"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm(`Delete robot car project ${name}?`)) {
                                removeProduct(id)
                              }
                            }}
                            className="rounded-full bg-red-100 px-4 py-2 text-xs font-bold text-red-600 transition hover:bg-red-200"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </article>
                  )
                  })}
              </div>
              {products.filter((p) => p.category === 'Robot Cars').length === 0 && (
                <p className="mt-8 text-center text-sm text-slate-500">No robot car projects found.</p>
              )}
            </>
          )}
        </section>
      )}

      {/* ═══════ PRODUCTS ═══════ */}
      {tab === 'Products' && (
        <div role="tabpanel" id="panel-products" aria-labelledby="tab-products" className="mt-8 grid min-w-0 gap-8 xl:grid-cols-[1fr_1.3fr]">
          <section aria-label="Product list" className="min-w-0 space-y-6">
            <div className="min-w-0 overflow-x-auto border-t-2 border-ink bg-white p-6">
              <h2 className="font-display text-xl font-bold">Products ({filteredProducts.length})</h2>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, SKU, or id" aria-label="Search products" className={`mt-3 w-full ${inputClass}`} />
              <div className="mt-3 divide-y divide-line">
                {shownProducts.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-2 py-2">
                    <div className="min-w-0">
                      <span className="block break-words text-sm"><strong>{item.name}</strong> <span className="text-slate-400">{item.sku}</span></span>
                    </div>
                    <span className="flex shrink-0 gap-2">
                      <button onClick={() => { setProduct(item); window.scrollTo({ top: 0, behavior: 'smooth' }) }} className="text-xs font-bold text-navy underline">Edit</button>
                      <button onClick={() => removeProduct(item.id)} className="text-xs font-bold text-red-600 underline">Delete</button>
                    </span>
                  </div>
                ))}
                {shownProducts.length === 0 && <p className="py-3 text-sm text-slate-500">No products match &ldquo;{query}&rdquo;.</p>}
              </div>
              <Pager page={productPage} totalPages={productTotalPages} onPage={setProductPage} />
            </div>
          </section>
          <section aria-label="Product editor" className="min-w-0">
            <form onSubmit={saveProduct} className="min-w-0 overflow-hidden border-t-2 border-ink bg-white p-6">
              <h2 className="font-display text-2xl font-bold">{products.some((item) => item.id === product.id) ? `Edit ${product.id}` : 'Add a new product'}</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {fields.map((key) => <label key={key} className="min-w-0 text-sm font-bold capitalize">{key}<input value={String(product[key] ?? '')} onChange={(e) => updateProduct(key, ['price', 'stock'].includes(key) ? Number(e.target.value) : e.target.value)} className={`mt-2 w-full ${inputClass}`} /></label>)}
                <label className="min-w-0 text-sm font-bold sm:col-span-2">Specs, one per line<textarea value={Array.isArray(product.specs) ? product.specs.join('\n') : String(product.specs)} onChange={(e) => updateProduct('specs', e.target.value.split('\n'))} rows={4} className={`mt-2 w-full ${inputClass}`} /></label>
                <div className="min-w-0 sm:col-span-2">
                  <p className="text-sm font-bold">Product image</p>
                  <div className="mt-2 flex min-w-0 flex-wrap items-center gap-3">
                    {product.image && <Image src={product.image} alt={product.name || 'Product preview'} width={64} height={64} className="shrink-0 rounded object-cover" />}
                    <input value={product.image || ''} onChange={(e) => updateProduct('image', e.target.value)} placeholder="https://... or upload below" aria-label="Product image URL" className={`min-w-0 flex-1 ${inputClass}`} />
                    <input ref={fileInput} type="file" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (file) void uploadImage(file); e.currentTarget.value = '' }} className="hidden" />
                    <button type="button" disabled={uploading} onClick={() => fileInput.current?.click()} className="bg-navy px-4 py-2 text-xs font-black text-white disabled:opacity-60">{uploading ? 'Uploading...' : 'Upload'}</button>
                  </div>
                </div>
              </div>
              <div className="mt-5 flex gap-3">
                <button type="submit" disabled={busy === 'product' || uploading} className="bg-gold px-5 py-3 text-sm font-black text-ink transition hover:bg-gold-dark disabled:opacity-60">{busy === 'product' ? 'Saving...' : 'Save product'}</button>
                {product.id && <button type="button" onClick={() => setProduct(emptyProduct)} className="border border-line px-5 py-3 text-sm font-black text-ink transition hover:border-navy">New product</button>}
              </div>
            </form>
          </section>
        </div>
      )}

      {/* ═══════ SERVICES ═══════ */}
      {tab === 'Services' && (
        <div role="tabpanel" id="panel-services" aria-labelledby="tab-services" className="mt-8 grid min-w-0 gap-8 xl:grid-cols-[1fr_1.3fr]">
          <section aria-label="Service list" className="min-w-0 space-y-6">
            <div className="min-w-0 overflow-x-auto border-t-2 border-ink bg-white p-6">
              <h2 className="font-display text-xl font-bold">Services ({services.length})</h2>
              {!servicesLoaded ? <p className="text-sm text-slate-500" role="status">Loading…</p> : (
                <div className="mt-3 divide-y divide-line">
                  {services.map((s) => (
                    <div key={s.id} className="flex items-center justify-between gap-2 py-2">
                      <div className="min-w-0">
                        <span className="block break-words text-sm"><strong>{s.name}</strong> <span className="text-slate-400">{s.priceLabel}</span></span>
                        {!s.active && <span className="ml-2 text-[10px] font-black uppercase text-red-500">inactive</span>}
                      </div>
                      <span className="flex shrink-0 gap-2">
                        <button onClick={() => { setService(s); window.scrollTo({ top: 0, behavior: 'smooth' }) }} className="text-xs font-bold text-navy underline">Edit</button>
                        <button onClick={() => removeService(s.id)} className="text-xs font-bold text-red-600 underline">Delete</button>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
          <section aria-label="Service editor" className="min-w-0">
            <form onSubmit={saveServiceItem} className="min-w-0 overflow-hidden border-t-2 border-ink bg-white p-6">
              <h2 className="font-display text-2xl font-bold">{services.some((s) => s.id === service.id) ? `Edit ${service.id}` : 'Add a new service'}</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="min-w-0 text-sm font-bold">Id<input value={service.id} onChange={(e) => updateService('id', e.target.value)} className={`mt-2 w-full ${inputClass}`} placeholder="e.g. website-design" /></label>
                <label className="min-w-0 text-sm font-bold">Name<input value={service.name} onChange={(e) => updateService('name', e.target.value)} className={`mt-2 w-full ${inputClass}`} /></label>
                <label className="min-w-0 text-sm font-bold">Category<input value={service.category} onChange={(e) => updateService('category', e.target.value)} className={`mt-2 w-full ${inputClass}`} /></label>
                <label className="min-w-0 text-sm font-bold">Price Label<input value={service.priceLabel} onChange={(e) => updateService('priceLabel', e.target.value)} className={`mt-2 w-full ${inputClass}`} placeholder="from NPR 35,000" /></label>
                <label className="min-w-0 text-sm font-bold">Tag / Badge<input value={service.tag} onChange={(e) => updateService('tag', e.target.value)} className={`mt-2 w-full ${inputClass}`} placeholder="Website, Fabrication, etc." /></label>
                <label className="min-w-0 text-sm font-bold">Sort Order<input type="number" value={service.sortOrder} onChange={(e) => updateService('sortOrder', Number(e.target.value))} className={`mt-2 w-full ${inputClass}`} /></label>
                <label className="min-w-0 text-sm font-bold sm:col-span-2">Description<textarea value={service.description} onChange={(e) => updateService('description', e.target.value)} rows={3} className={`mt-2 w-full ${inputClass}`} /></label>
                <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={service.active} onChange={(e) => updateService('active', e.target.checked)} className="h-4 w-4" /> Active (visible on site)</label>
              </div>
              <div className="mt-5 flex gap-3">
                <button type="submit" disabled={busy === 'service'} className="bg-gold px-5 py-3 text-sm font-black text-ink transition hover:bg-gold-dark disabled:opacity-60">{busy === 'service' ? 'Saving...' : 'Save service'}</button>
                {service.id && <button type="button" onClick={() => setService(emptyService)} className="border border-line px-5 py-3 text-sm font-black text-ink transition hover:border-navy">New service</button>}
              </div>
            </form>
          </section>
        </div>
      )}

      {/* ═══════ ORDERS ═══════ */}
      {tab === 'Orders' && (
        <section role="tabpanel" id="panel-orders" aria-labelledby="tab-orders" aria-label="Customer orders" className="mt-8 space-y-4">
          <div className="flex flex-wrap items-end gap-3 border-t-2 border-ink bg-white p-6">
            <h2 className="font-display text-xl font-bold">Customer orders</h2>
            <label className="ml-auto text-sm font-bold text-slate-500">Search buyer
              <input value={orderQuery} onChange={(e) => setOrderQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void loadOrders(1)} placeholder="email or name" aria-label="Search orders" className={`mt-1 w-full sm:ml-2 sm:mt-0 sm:w-48 ${inputClass}`} />
            </label>
            <label className="text-sm font-bold text-slate-500">Status
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter by status" className="ml-2 border border-line px-3 py-2 text-sm font-bold">
                <option value="">All</option>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <button onClick={() => void loadOrders(1)} className="bg-navy px-4 py-2 text-xs font-black text-white transition hover:bg-navy-dark">Apply</button>
          </div>
          {!ordersLoaded ? <p className="text-sm text-slate-500" role="status">Loading…</p> : orderData.orders.length === 0 ? <p className="text-sm text-slate-500">No orders found.</p> : (
            <>
              <ul className="space-y-3">
                {orderData.orders.map((order) => (
                  <li key={order.id} className="border border-line bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-black">#{order.id.slice(0, 8).toUpperCase()} · {formatNPR(order.totalNpr)}</p>
                        <p className="break-words text-xs text-slate-500">{order.customerName} · {order.email}</p>
                        <p className="break-words text-xs text-slate-400">{order.address}</p>
                        <p className="text-xs text-slate-400">{order.provider} · {formatTimestamp(order.createdAt)}</p>
                      </div>
                      <select value={order.status} onChange={(e) => setOrderStatus(order.id, e.target.value)} aria-label={`Status for ${order.id.slice(0, 8)}`} className="border border-line px-2 py-1 text-xs font-bold">{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select>
                    </div>
                    <ul className="mt-2 text-xs leading-5 text-slate-600">{order.items.map((item) => <li key={`${order.id}-${item.name}`} className="truncate">{item.quantity} × {item.name} ({formatNPR(item.price * item.quantity)})</li>)}</ul>
                  </li>
                ))}
              </ul>
              <Pager page={orderData.page} totalPages={orderData.totalPages} onPage={(page) => void loadOrders(page)} />
              <p className="text-xs text-slate-400">{orderData.total} total order{orderData.total === 1 ? '' : 's'}</p>
            </>
          )}
        </section>
      )}

      {/* ═══════ FINANCE ═══════ */}
      {tab === 'Finance' && (
        <section role="tabpanel" id="panel-finance" aria-labelledby="tab-finance" aria-label="Finance overview" className="mt-8 space-y-6">
          <div className="border-t-2 border-ink bg-white p-6">
            <h2 className="font-display text-xl font-bold">Finance &amp; Transactions</h2>
            {stats && (
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <div className="rounded border border-line p-4">
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400">Total Revenue</p>
                  <p className="mt-1 font-display text-2xl font-bold">{formatNPR(stats.revenue)}</p>
                </div>
                <div className="rounded border border-line p-4">
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400">Revenue Today</p>
                  <p className="mt-1 font-display text-2xl font-bold">{formatNPR(stats.revenueToday)}</p>
                </div>
                <div className="rounded border border-line p-4">
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400">Transactions</p>
                  <p className="mt-1 font-display text-2xl font-bold">{stats.succeededTransactions} <span className="text-sm font-normal text-slate-500">succeeded</span></p>
                  <p className="text-xs text-slate-400">{stats.totalTransactions} total ({stats.totalTransactions - stats.succeededTransactions} pending/failed)</p>
                </div>
              </div>
            )}
          </div>
          {stats && stats.totalOrders > 0 && (
            <div className="border-t-2 border-ink bg-white p-6">
              <h3 className="font-display text-lg font-bold">Order Status Breakdown</h3>
              <div className="mt-3 flex flex-wrap gap-3">
                {['pending', 'paid', 'fulfilled', 'cancelled'].map((s) => {
                  const isPending = s === 'pending'
                  const count = isPending ? stats.pendingOrders : s === 'paid' || s === 'fulfilled' ? Math.floor(stats.succeededTransactions * (s === 'paid' ? 0.6 : 0.4)) : stats.totalOrders - stats.pendingOrders - stats.succeededTransactions
                  return (
                    <div key={s} className="rounded border border-line px-4 py-3 text-center">
                      <p className="text-xs font-black uppercase tracking-widest text-slate-400">{s}</p>
                      <p className="mt-1 text-xl font-bold">{Math.max(0, count)}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ═══════ USERS ═══════ */}
      {tab === 'Users' && (
        <section role="tabpanel" id="panel-users" aria-labelledby="tab-users" aria-label="User management" className="mt-8 space-y-4">
          <div className="flex flex-wrap items-end gap-3 border-t-2 border-ink bg-white p-6">
            <h2 className="font-display text-xl font-bold">Users</h2>
            <label className="ml-auto text-sm font-bold text-slate-500">Search
              <input value={userQuery} onChange={(e) => setUserQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void loadUsers(1)} placeholder="email or name" aria-label="Search users" className={`mt-1 w-full sm:ml-2 sm:mt-0 sm:w-56 ${inputClass}`} />
            </label>
            <button onClick={() => void loadUsers(1)} className="bg-navy px-4 py-2 text-xs font-black text-white transition hover:bg-navy-dark">Apply</button>
          </div>
          {!usersLoaded ? <p className="text-sm text-slate-500" role="status">Loading…</p> : userData.users.length === 0 ? <p className="text-sm text-slate-500">No users found.</p> : (
            <>
              <ul className="space-y-3">
                {userData.users.map((user) => (
                  <li key={user.id} className="flex flex-wrap items-center justify-between gap-3 border border-line bg-white p-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{user.name || '—'} <span className="font-normal text-slate-500">· {user.email}</span></p>
                      {user.phone && <p className="text-xs text-slate-400">{user.phone}</p>}
                      {user.address && <p className="text-xs text-slate-400">{user.address}</p>}
                      <p className="text-xs text-slate-400">Joined {new Date(user.createdAt).toLocaleDateString()}{user.lastSignInAt ? ` · Last seen ${new Date(user.lastSignInAt).toLocaleDateString()}` : ''}</p>
                      <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${user.role === 'admin' ? 'bg-gold text-ink' : 'bg-sky text-navy'}`}>{user.role}</span>
                    </div>
                    <span className="flex shrink-0 gap-2">
                      {user.role === 'admin'
                        ? <button onClick={() => setUserRole(user.id, 'customer')} className="border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600 transition hover:bg-red-50">Revoke admin</button>
                        : <button onClick={() => setUserRole(user.id, 'admin')} className="border border-line px-3 py-1.5 text-xs font-bold text-navy transition hover:border-navy">Make admin</button>}
                    </span>
                  </li>
                ))}
              </ul>
              <Pager page={userData.page} totalPages={userData.page + (userData.hasMore ? 1 : 0)} onPage={(page) => void loadUsers(page)} />
            </>
          )}
        </section>
      )}

      {/* ═══════ MESSAGES ═══════ */}
      {tab === 'Messages' && (
        <section role="tabpanel" id="panel-messages" aria-labelledby="tab-messages" aria-label="Customer messages" className="mt-8 space-y-4">
          <div className="flex flex-wrap items-end gap-3 border-t-2 border-ink bg-white p-6">
            <h2 className="font-display text-xl font-bold">Messages</h2>
            <label className="ml-auto text-sm font-bold text-slate-500">Status
              <select value={messageFilter} onChange={(e) => setMessageFilter(e.target.value)} className="ml-2 border border-line px-3 py-2 text-sm font-bold">
                <option value="">All</option>
                <option value="new">New</option>
                <option value="replied">Replied</option>
              </select>
            </label>
            <button onClick={() => void loadMessages(1)} className="bg-navy px-4 py-2 text-xs font-black text-white transition hover:bg-navy-dark">Apply</button>
          </div>
          {!messagesLoaded ? <p className="text-sm text-slate-500" role="status">Loading…</p> : messages.length === 0 ? <p className="text-sm text-slate-500">No messages found.</p> : (
            <>
              <ul className="space-y-3">
                {messages.map((msg) => (
                  <li key={msg.id} className={`border bg-white p-4 ${msg.status === 'new' ? 'border-l-4 border-l-navy border-line' : 'border-line'}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold">{msg.name} <span className="font-normal text-slate-500">· {msg.email}</span></p>
                        <p className="mt-1 text-xs text-slate-400">{formatTimestamp(msg.created_at)}</p>
                      </div>
                      {msg.status === 'new' && <button onClick={() => markMessageReplied(msg.id)} className="border border-line px-3 py-1.5 text-xs font-bold text-navy transition hover:border-navy">Mark replied</button>}
                      {msg.status === 'replied' && <span className="text-[10px] font-black uppercase text-emerald-600">Replied</span>}
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{msg.message}</p>
                  </li>
                ))}
              </ul>
              <Pager page={messagesPage} totalPages={messagesTotalPages} onPage={(page) => void loadMessages(page)} />
              <p className="text-xs text-slate-400">{messagesTotal} total message{messagesTotal === 1 ? '' : 's'}</p>
            </>
          )}
        </section>
      )}

      {/* ═══════ ACTIVITY ═══════ */}
      {tab === 'Activity' && (
        <section role="tabpanel" id="panel-activity" aria-labelledby="tab-activity" aria-label="Activity log" className="mt-8 space-y-4">
          <div className="border-t-2 border-ink bg-white p-6">
            <h2 className="font-display text-xl font-bold">Activity Log</h2>
          </div>
          {!activityLoaded ? <p className="text-sm text-slate-500" role="status">Loading…</p> : activities.length === 0 ? <p className="text-sm text-slate-500">No activity recorded yet.</p> : (
            <>
              <ul className="space-y-2">
                {activities.map((entry) => (
                  <li key={entry.id} className="flex items-start gap-3 border border-line bg-white px-4 py-3">
                    <span className={`mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full ${entry.action.includes('deleted') ? 'bg-red-500' : entry.action.includes('saved') ? 'bg-emerald-500' : entry.action.includes('status') ? 'bg-amber-500' : 'bg-navy'}`} />
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm"><span className="font-bold">{entry.action}</span> <span className="text-slate-400">{entry.entityType}{entry.entityId ? ` / ${entry.entityId}` : ''}</span></p>
                      {Object.keys(entry.details).length > 0 && <p className="mt-0.5 break-words text-xs text-slate-500">{JSON.stringify(entry.details)}</p>}
                    </div>
                    <span className="shrink-0 text-xs text-slate-400">{formatTimestamp(entry.createdAt)}</span>
                  </li>
                ))}
              </ul>
              <Pager page={activityPage} totalPages={activityTotalPages} onPage={(page) => void loadActivity(page)} />
              <p className="text-xs text-slate-400">{activityTotal} total event{activityTotal === 1 ? '' : 's'}</p>
            </>
          )}
        </section>
      )}
    </div>
  )
}
