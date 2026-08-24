'use client'

import Link from 'next/link'
import { FormEvent, useEffect, useState } from 'react'
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
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)

  useEffect(() => {
    fetch('/api/customer/me').then((response) => response.json()).then((data) => setCustomer(data.customer)).catch(() => undefined)
    fetch('/api/orders').then((response) => (response.ok ? response.json() : { orders: [] })).then((data) => setOrders(data.orders || [])).catch(() => undefined)
  }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('')
    const data = Object.fromEntries(new FormData(event.currentTarget).entries())
    const response = await fetch(`/api/customer/${mode}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) { setError(result.error || 'Something went wrong. Please try again.'); setBusy(false); return }
    if (result.needsEmailConfirmation) {
      setMode('login'); setNotice('Account created. Check your email and confirm your address, then sign in.'); setBusy(false); return
    }
    const localCart = JSON.parse(window.localStorage.getItem('genum-cart') || '[]')
    if (localCart.length) await fetch('/api/cart', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cart: localCart }) })
    window.location.reload()
  }

  async function sendReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('')
    const data = Object.fromEntries(new FormData(event.currentTarget).entries())
    const response = await fetch('/api/auth/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) { setError(result.error || 'Could not send the email.'); setBusy(false); return }
    setNotice('If an account exists for that email, a password-reset link is on its way.'); setBusy(false)
  }

  async function logout() { await fetch('/api/customer/logout', { method: 'POST' }); window.location.reload() }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setProfileSaved(false)
    const data = Object.fromEntries(new FormData(event.currentTarget).entries())
    const response = await fetch('/api/customer/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    if (response.ok) { setProfileSaved(true); setCustomer((current) => current ? { ...current, ...data } : current) } else { setError('Could not save your details.') }
    setBusy(false)
  }

  if (!customer) return (
    <main className="grid-paper flex min-h-[70vh] items-center justify-center px-5 py-14">
      <form onSubmit={mode === 'forgot' ? sendReset : submit} className="w-full max-w-md border-t-4 border-cobalt bg-white p-8 shadow-xl">
        <p className="text-xs font-black uppercase tracking-widest text-cobalt">Customer account</p>
        <h1 className="mt-4 font-display text-4xl font-bold">{mode === 'login' ? 'Welcome back.' : mode === 'register' ? 'Create your account.' : 'Reset password.'}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">{mode === 'forgot' ? 'Enter your account email and we will send you a reset link.' : 'Save your build list, track orders, and return to your history from any device.'}</p>
        {mode === 'register' && <label className="mt-7 block text-sm font-bold">Name<input name="name" required className="mt-2 w-full border border-line px-3 py-3" /></label>}
        <label className="mt-5 block text-sm font-bold">Email<input name="email" type="email" required className="mt-2 w-full border border-line px-3 py-3" /></label>
        {mode !== 'forgot' && <label className="mt-5 block text-sm font-bold">Password<input name="password" type="password" minLength={6} required className="mt-2 w-full border border-line px-3 py-3" /></label>}
        {error && <p className="mt-4 text-sm font-bold text-red-600">{error}</p>}
        {notice && <p className="mt-4 text-sm font-bold text-emerald-700">{notice}</p>}
        <button disabled={busy} className="mt-7 w-full bg-cobalt px-5 py-3.5 text-sm font-black text-white disabled:opacity-60">{busy ? 'Please wait...' : mode === 'login' ? 'Log in' : mode === 'register' ? 'Register' : 'Send reset link'}</button>
        {mode !== 'forgot' && (
          <>
            <div className="my-5 flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-slate-400"><span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" /></div>
            <a href="/api/auth/google" className="flex w-full items-center justify-center gap-3 border border-line px-5 py-3.5 text-sm font-black hover:border-cobalt"><svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" /><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" /><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" /><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" /></svg>Continue with Google</a>
          </>
        )}
        {mode !== 'forgot' && <button type="button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); setNotice('') }} className="mt-5 text-sm font-bold text-cobalt underline">{mode === 'login' ? 'Create a customer account' : 'I already have an account'}</button>}
        {mode === 'login' && <button type="button" onClick={() => { setMode('forgot'); setError(''); setNotice('') }} className="mt-2 block text-sm font-bold text-cobalt underline">Forgot password?</button>}
        {mode === 'forgot' && <button type="button" onClick={() => { setMode('login'); setError(''); setNotice('') }} className="mt-5 text-sm font-bold text-cobalt underline">Back to sign in</button>}
      </form>
    </main>
  )

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
