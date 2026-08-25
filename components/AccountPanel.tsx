'use client'

import Link from 'next/link'
import { FormEvent, ReactNode, useEffect, useState } from 'react'
import AuthPanel from './AuthPanel'
import { formatNPR } from '../lib/catalog'
import { initials } from '../lib/identity'
import { useCart } from './cart-provider'

type Customer = {
  id: string
  name: string
  email: string
  phone?: string
  address?: string
  role?: 'admin' | 'customer'
  cart: { productId: string; quantity: number }[]
  messages: { message: string; createdAt: string; status: string }[]
}
type Order = { id: string; items: { name: string; quantity: number; price: number }[]; totalNpr: number; status: string; provider: string; createdAt: string }

const statusStyles: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  paid: 'bg-emerald-100 text-emerald-800',
  fulfilled: 'bg-cobalt/10 text-cobalt',
  cancelled: 'bg-red-100 text-red-700',
}

const inputClass = 'mt-2 w-full rounded-lg border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-cobalt focus:ring-2 focus:ring-cobalt/20'

function SectionCard({ title, id, children }: { title: string; id?: string; children: ReactNode }) {
  return (
    <section id={id} className="rounded-2xl border border-line bg-white p-6 shadow-card sm:p-8">
      <h2 className="font-display text-xl font-bold text-ink">{title}</h2>
      {children}
    </section>
  )
}

export default function AccountPanel() {
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  const { clear } = useCart()
  const [busy, setBusy] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/customer/me').then((response) => response.json()).then((data) => setCustomer(data.customer)),
      fetch('/api/orders').then((response) => (response.ok ? response.json() : { orders: [] })).then((data) => setOrders(data.orders || [])),
    ]).catch(() => undefined).finally(() => setLoaded(true))
  }, [])

  async function logout() {
    clear()
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/'
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setProfileSaved(false)
    const data = Object.fromEntries(new FormData(event.currentTarget).entries())
    const response = await fetch('/api/customer/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    if (response.ok) { setProfileSaved(true); setCustomer((current) => current ? { ...current, ...data } : current) } else { setError('Could not save your details.') }
    setBusy(false)
  }

  if (!loaded) {
    return (
      <main className="grid-paper min-h-[70vh]">
        <div className="mx-auto max-w-5xl space-y-6 px-5 py-12 lg:px-8" aria-hidden="true">
          <div className="h-36 animate-pulse border border-line bg-white" />
          <div className="grid gap-4 sm:grid-cols-3"><div className="h-28 animate-pulse border border-line bg-white" /><div className="h-28 animate-pulse border border-line bg-white" /><div className="h-28 animate-pulse border border-line bg-white" /></div>
        </div>
      </main>
    )
  }

  if (!customer) return <AuthPanel initialMode="signup" />

  return (
    <main className="grid-paper min-h-[70vh]">
      <div className="mx-auto max-w-5xl space-y-6 px-5 py-12 lg:px-8">

        <header className="border-t-4 border-cobalt bg-white p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-5">
            <div className="flex items-center gap-4">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-cobalt font-display text-lg font-black text-white">{initials(customer.name)}</span>
              <div>
                <p className="text-xs font-black uppercase tracking-[.25em] text-cobalt">Customer account</p>
                <h1 className="mt-1 font-display text-2xl font-bold text-ink sm:text-3xl">Welcome, {customer.name}.</h1>
                <p className="mt-1 text-sm text-slate-600">{customer.email}</p>
              </div>
            </div>
            <button onClick={logout} className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink transition hover:border-red-300 hover:text-red-600">Log out</button>
          </div>
        </header>

        <div className="grid gap-4 sm:grid-cols-3">
          <a href="#orders" className="rounded-2xl border border-line bg-white p-5 shadow-card transition hover:border-cobalt">
            <strong className="block font-display text-3xl font-bold text-ink">{orders.length}</strong>
            <span className="mt-1 block text-sm font-semibold text-muted">Order{orders.length === 1 ? '' : 's'} placed</span>
          </a>
          <Link href="/checkout" className="rounded-2xl border border-line bg-white p-5 shadow-card transition hover:border-cobalt">
            <strong className="block font-display text-3xl font-bold text-ink">{customer.cart.length}</strong>
            <span className="mt-1 block text-sm font-semibold text-muted">Item types in build list</span>
          </Link>
          <Link href="/contact" className="rounded-2xl border border-line bg-white p-5 shadow-card transition hover:border-cobalt">
            <strong className="block font-display text-3xl font-bold text-ink">{customer.messages.length}</strong>
            <span className="mt-1 block text-sm font-semibold text-muted">Support message{customer.messages.length === 1 ? '' : 's'}</span>
          </Link>
        </div>

        <SectionCard title="Your orders" id="orders">
          {orders.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No orders yet — they appear here right after checkout.</p>
          ) : (
            <div className="mt-5 space-y-3">
              {orders.map((order) => (
                <div key={order.id} className="border border-line p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-bold text-ink">#{order.id.slice(0, 8).toUpperCase()}</p>
                      <p className="text-xs text-slate-500">{new Date(order.createdAt).toLocaleDateString()} · {order.provider === 'cod' ? 'Pay on delivery' : order.provider === 'esewa' ? 'eSewa' : order.provider === 'khalti' ? 'Khalti' : order.provider}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-wide ${statusStyles[order.status] || 'bg-slate-100 text-slate-700'}`}>{order.status}</span>
                      <span className="font-black text-ink">{formatNPR(order.totalNpr)}</span>
                    </div>
                  </div>
                  <ul className="mt-2 text-xs leading-5 text-slate-600">{order.items.map((item) => <li key={`${order.id}-${item.name}`}>{item.quantity} × {item.name}</li>)}</ul>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Your details">
          <p className="mt-2 text-sm text-slate-600">Used for delivery and order updates.</p>
          <form onSubmit={saveProfile} className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-bold text-ink sm:col-span-2">Name<input name="name" defaultValue={customer.name} autoComplete="name" className={inputClass} /></label>
            <label className="block text-sm font-bold text-ink">Phone<input name="phone" type="tel" defaultValue={customer.phone || ''} autoComplete="tel" className={inputClass} /></label>
            <label className="block text-sm font-bold text-ink sm:col-span-2">Delivery address<textarea name="address" defaultValue={customer.address || ''} rows={3} className={inputClass} /></label>
            <div className="flex items-center gap-3 sm:col-span-2">
              <button disabled={busy} className="rounded-lg bg-signal px-5 py-3 text-sm font-bold text-ink shadow-sm transition hover:bg-signal-dark disabled:opacity-60">{busy ? 'Saving…' : 'Save details'}</button>
              {profileSaved && <span role="status" className="text-sm font-bold text-emerald-700">Details saved.</span>}
              {error && <span role="alert" className="text-sm font-bold text-red-600">{error}</span>}
            </div>
          </form>
        </SectionCard>

        <SectionCard title="Your messages">
          {customer.messages.length === 0 ? (
            <p className="mt-3 pb-2 text-sm text-slate-500">No messages yet. <Link href="/contact" className="font-bold text-cobalt underline">Ask us about a project</Link>.</p>
          ) : (
            <div className="mt-4 divide-y divide-line">
              {customer.messages.map((item) => (
                <div key={item.createdAt} className="py-4 first:pt-0 last:pb-0">
                  <p className="text-sm leading-6 text-slate-700">{item.message}</p>
                  <p className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                    {new Date(item.createdAt).toLocaleDateString()}
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${item.status === 'resolved' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{item.status}</span>
                  </p>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

      </div>
    </main>
  )
}
