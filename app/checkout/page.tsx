'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { formatNPR, type Product } from '../../lib/catalog'

type CartLine = { productId: string; quantity: number }

export default function CheckoutPage() {
  const [lines, setLines] = useState<CartLine[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [customer, setCustomer] = useState({ name: '', email: '', phone: '', address: '' })
  const [account, setAccount] = useState<{ name: string; email: string } | null>(null)

  useEffect(() => {
    fetch('/api/products').then((response) => response.json()).then(setProducts).catch(() => undefined)
    fetch('/api/cart').then((response) => response.json()).then((data) => setLines(data.authenticated ? data.cart : JSON.parse(window.localStorage.getItem('genum-cart') || '[]'))).catch(() => setLines(JSON.parse(window.localStorage.getItem('genum-cart') || '[]')))
    fetch('/api/customer/me').then((response) => response.json()).then((data) => {
      const me = data.customer
      if (!me) return
      setAccount({ name: me.name, email: me.email })
      setCustomer((current) => ({
        ...current,
        name: current.name || me.name || '',
        email: current.email || me.email || '',
        phone: current.phone || me.phone || '',
        address: current.address || me.address || '',
      }))
    }).catch(() => undefined)
  }, [])

  const items = useMemo(() => lines.map((line) => { const product = products.find((item) => item.id === line.productId); return product ? { product, quantity: line.quantity } : null }).filter(Boolean) as { product: Product; quantity: number }[], [lines, products])
  const total = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0)

  function persist(next: CartLine[]) {
    window.localStorage.setItem('genum-cart', JSON.stringify(next))
    if (account) void fetch('/api/cart', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cart: next }) })
  }

  function changeQuantity(productId: string, quantity: number) {
    const next = lines.map((line) => line.productId === productId ? { ...line, quantity } : line).filter((line) => line.quantity > 0)
    setLines(next)
    persist(next)
  }

  function validate() {
    if (!customer.name || !customer.email || !customer.address) { setMessage('Add your name, email, and delivery address to continue.'); return false }
    if (!account) { setMessage('Sign in to place your order - your build list is saved automatically.'); return false }
    return true
  }

  async function payStripe() {
    if (!validate()) return
    setBusy(true); setMessage('Preparing secure Stripe checkout...')
    const response = await fetch('/api/checkout/stripe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: items.map(({ product, quantity }) => ({ productId: product.id, quantity })), customer }) })
    const result = await response.json()
    if (result.url) window.location.href = result.url
    else { setMessage(result.error || 'Payment setup is not configured yet.'); setBusy(false) }
  }

  async function payCod() {
    if (!validate()) return
    setBusy(true); setMessage('Placing your order...')
    const response = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: 'cod', items: items.map(({ product, quantity }) => ({ productId: product.id, name: product.name, price: product.price, quantity })), customer }) })
    const result = await response.json()
    if (result.ok && result.order?.id) { window.localStorage.removeItem('genum-cart'); window.location.href = `/checkout/success?order=${result.order.id}` }
    else { setMessage(result.error || 'Could not place the order.'); setBusy(false) }
  }

  function submitGatewayForm(action: string, fields: Record<string, string>) {
    const form = document.createElement('form')
    form.method = 'POST'
    form.action = action
    Object.entries(fields).forEach(([name, value]) => {
      const input = document.createElement('input')
      input.type = 'hidden'
      input.name = name
      input.value = value
      form.appendChild(input)
    })
    document.body.appendChild(form)
    form.submit()
  }

  async function payNepal(provider: 'esewa' | 'khalti') {
    if (!validate()) return
    setBusy(true); setMessage(`Preparing ${provider === 'esewa' ? 'eSewa' : 'Khalti'} payment...`)
    try {
      const response = await fetch(`/api/checkout/${provider}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: items.map(({ product, quantity }) => ({ productId: product.id, quantity })), customer }) })
      const result = await response.json()
      if (provider === 'khalti' && result.url) { window.location.href = result.url; return }
      if (provider === 'esewa' && result.action && result.fields) { window.localStorage.removeItem('genum-cart'); submitGatewayForm(result.action, result.fields); return }
      setMessage(result.error || `${provider} is not configured yet.`); setBusy(false)
    } catch {
      setMessage(`${provider === 'esewa' ? 'eSewa' : 'Khalti'} payment could not be started. Try again.`); setBusy(false)
    }
  }

  return <main className="min-h-screen bg-mist"><header className="border-b border-line bg-white"><div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8"><Link href="/" className="flex items-center gap-3"><Image src="/logo.png" alt="GENUM stamp" width={48} height={48} className="h-11 w-11 object-contain" /><span className="font-display text-lg font-bold">GENUM checkout</span></Link><div className="flex items-center gap-5"><Link href="/products" className="text-sm font-bold text-cobalt">Continue shopping</Link>{account && <Link href="/account" className="text-sm font-bold text-cobalt">My account</Link>}</div></div></header><div className="mx-auto max-w-7xl px-5 py-12 lg:px-8"><p className="text-xs font-black uppercase tracking-[.24em] text-cobalt">Secure order</p><h1 className="mt-3 font-display text-5xl font-bold tracking-[-.04em]">Ready to build?</h1>
    {!account && items.length > 0 && <div className="mt-6 rounded-2xl border border-cobalt bg-white p-5 text-sm text-slate-700"><strong className="text-ink">Sign in to place your order.</strong> Your build list is already saved and will merge into your account. <Link href="/login" className="font-bold text-cobalt underline">Sign in or create an account</Link></div>}
    {items.length === 0 ? <div className="mt-10 rounded-2xl border border-dashed border-line bg-white p-12 text-center"><h2 className="font-display text-2xl font-bold">Your build list is empty.</h2><Link href="/products" className="mt-5 inline-block rounded-full bg-cobalt px-5 py-3 text-sm font-black text-white">Browse products</Link></div> : <div className="mt-10 grid gap-10 lg:grid-cols-[1.1fr_.9fr]">
      <section className="rounded-2xl border border-line bg-white p-6"><h2 className="font-display text-2xl font-bold">Delivery details</h2><div className="mt-6 grid gap-3 sm:grid-cols-2"><input value={customer.name} onChange={(event) => setCustomer({ ...customer, name: event.target.value })} className="border border-line bg-mist px-4 py-3 text-sm sm:col-span-2" placeholder="Full name" /><input value={customer.email} onChange={(event) => setCustomer({ ...customer, email: event.target.value })} className="border border-line bg-mist px-4 py-3 text-sm" placeholder="Email" type="email" /><input value={customer.phone} onChange={(event) => setCustomer({ ...customer, phone: event.target.value })} className="border border-line bg-mist px-4 py-3 text-sm" placeholder="Phone" /><textarea value={customer.address} onChange={(event) => setCustomer({ ...customer, address: event.target.value })} rows={3} className="border border-line bg-mist px-4 py-3 text-sm sm:col-span-2" placeholder="Delivery address in Nepal" /></div><p className="mt-4 text-xs leading-5 text-slate-500">Free Kathmandu delivery on orders above NPR 5,000. We confirm every order by email before dispatch.</p></section>
      <section className="space-y-4"><div className="rounded-2xl border border-line bg-white p-6">{items.map(({ product, quantity }) => <div key={product.id} className="flex items-center justify-between gap-3 border-b border-line py-3 last:border-b-0 last:pb-0 first:pt-0"><div><p className="text-sm font-bold">{product.name}</p><p className="text-xs text-slate-500">{formatNPR(product.price)} each</p></div><div className="flex items-center gap-2"><button onClick={() => changeQuantity(product.id, quantity - 1)} className="h-8 w-8 border border-line font-black" aria-label={`Reduce ${product.name}`}>-</button><span className="w-6 text-center text-sm font-bold">{quantity}</span><button onClick={() => changeQuantity(product.id, quantity + 1)} className="h-8 w-8 border border-line font-black" aria-label={`Add ${product.name}`}>+</button></div></div>)}</div>
      <div className="rounded-2xl border-t-4 border-ink bg-white p-6"><div className="flex items-center justify-between text-lg font-black"><span>Total</span><span>{formatNPR(total)}</span></div><div className="mt-5 grid gap-3"><button onClick={payStripe} disabled={busy} className="bg-cobalt px-5 py-3.5 text-sm font-black text-white disabled:opacity-60">Pay with card (Stripe)</button><button onClick={() => payNepal('esewa')} disabled={busy} className="border border-line px-5 py-3.5 text-sm font-black text-ink disabled:opacity-60">Pay with eSewa</button><button onClick={() => payNepal('khalti')} disabled={busy} className="border border-line px-5 py-3.5 text-sm font-black text-ink disabled:opacity-60">Pay with Khalti</button><button onClick={payCod} disabled={busy} className="border-2 border-dashed border-line px-5 py-3.5 text-sm font-black text-slate-600 disabled:opacity-60">Reserve order · Pay on delivery</button></div>{message && <p className="mt-4 text-sm font-bold text-signal">{message}</p>}</div></section>
    </div>}
  </div></main>
}
