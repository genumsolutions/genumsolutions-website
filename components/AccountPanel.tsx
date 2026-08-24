'use client'

import Link from 'next/link'
import { FormEvent, useEffect, useState } from 'react'
import AuthPanel from './AuthPanel'
import { formatNPR } from '../lib/catalog'

type Customer = {
  id: string
  name: string
  email: string
  phone?: string
  address?: string
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

export default function AccountPanel() {
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/customer/me').then((response) => response.json()).then((data) => setCustomer(data.customer)),
      fetch('/api/orders').then((response) => (response.ok ? response.json() : { orders: [] })).then((data) => setOrders(data.orders || [])),
    ]).catch(() => undefined).finally(() => setLoaded(true))
  }, [])

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/'
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setProfileSaved(false)
    const data = Object.fromEntries(new FormData(event.currentTarget).entries())
    const response = await fetch('/api/customer/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    if (response.ok) { setProfileSaved(true); setCustomer((current) => current ? { ...current, ...data } : current) } else { setError('Could not save your details.') }
    setBusy(false)
  }

  if (!loaded) return <main className="grid-paper min-h-[70vh]" />

  if (!customer) return <AuthPanel initialMode="signup" />

  return (
    <section className="mx-auto max-w-4xl px-5 py-14 lg:px-8">
      <div className="border-t-2 border-ink bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><p className="text-xs font-black uppercase tracking-widest text-cobalt">Customer account</p><h1 className="mt-2 font-display text-4xl font-bold">Welcome, {customer.name}.</h1><p className="mt-2 text-slate-600">{customer.email}</p></div>
          <button onClick={logout} className="border border-line px-4 py-2 text-sm font-bold">Log out</button>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          <Link href="/checkout" className="border border-line p-5"><strong className="block font-display text-xl">Saved build list</strong><span className="mt-2 block text-sm text-slate-600">{customer.cart.length} item types saved in your account.</span></Link>
          <Link href="/contact" className="border border-line p-5"><strong className="block font-display text-xl">Message GENUM</strong><span className="mt-2 block text-sm text-slate-600">Ask about a project and keep your inquiry history here.</span></Link>
        </div>

        <h2 className="mt-10 font-display text-2xl font-bold">Your orders</h2>
        {orders.length === 0 ? <p className="mt-3 text-sm text-slate-500">No orders yet - they appear here right after checkout.</p> : (
          <div className="mt-3 space-y-3">
            {orders.map((order) => (
              <div key={order.id} className="border border-line p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-bold">#{order.id.slice(0, 8).toUpperCase()}</p>
                    <p className="text-xs text-slate-500">{new Date(order.createdAt).toLocaleDateString()} · {order.provider === 'cod' ? 'Pay on delivery' : order.provider === 'stripe' ? 'Card via Stripe' : order.provider}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-1 text-xs font-black uppercase ${statusStyles[order.status] || 'bg-slate-100 text-slate-700'}`}>{order.status}</span>
                    <span className="font-black">{formatNPR(order.totalNpr)}</span>
                  </div>
                </div>
                <ul className="mt-2 text-xs leading-5 text-slate-600">{order.items.map((item) => <li key={`${order.id}-${item.name}`}>{item.quantity} × {item.name}</li>)}</ul>
              </div>
            ))}
          </div>
        )}

        <h2 className="mt-10 font-display text-2xl font-bold">Your details</h2>
        <form onSubmit={saveProfile} className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-bold sm:col-span-2">Name<input name="name" defaultValue={customer.name} className="mt-2 w-full border border-line px-3 py-3" /></label>
          <label className="block text-sm font-bold">Phone<input name="phone" defaultValue={customer.phone || ''} className="mt-2 w-full border border-line px-3 py-3" /></label>
          <label className="block text-sm font-bold sm:col-span-2">Delivery address<textarea name="address" defaultValue={customer.address || ''} rows={3} className="mt-2 w-full border border-line px-3 py-3" /></label>
          <div className="sm:col-span-2"><button disabled={busy} className="bg-signal px-5 py-3 text-sm font-black text-ink disabled:opacity-60">Save details</button>{profileSaved && <span className="ml-3 text-sm font-bold text-emerald-700">Details saved.</span>}</div>
        </form>
        {error && <p className="mt-4 text-sm font-bold text-red-600">{error}</p>}

        <h2 className="mt-10 font-display text-2xl font-bold">Your messages</h2>
        {customer.messages.length === 0 ? <p className="mt-3 pb-6 text-sm text-slate-500">No messages yet.</p> : (
          <div className="mt-3 divide-y divide-line pb-6">
            {customer.messages.map((item) => <div key={item.createdAt} className="py-4"><p className="text-sm leading-6 text-slate-700">{item.message}</p><p className="mt-2 text-xs text-slate-500">{new Date(item.createdAt).toLocaleDateString()} · {item.status}</p></div>)}
          </div>
        )}
      </div>
    </section>
  )
}
