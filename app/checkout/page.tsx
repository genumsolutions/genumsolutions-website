'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { formatNPR, type Product } from '../../lib/catalog'
import { useCart } from '../../components/cart-provider'

export default function CheckoutPage() {
  const { lines, setQuantity, clear, hydrated } = useCart()
  const [products, setProducts] = useState<Product[]>([])
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [customer, setCustomer] = useState({ name: '', email: '', phone: '', address: '' })
  const [account, setAccount] = useState<{ name: string; email: string } | null>(null)

  useEffect(() => {
    fetch('/api/products').then((response) => response.json()).then(setProducts).catch(() => undefined)
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

  // Stock-aware view model: unknown products drop out, quantities clamp.
  const items = useMemo(
    () =>
      lines
        .map((line) => {
          const product = products.find((item) => item.id === line.productId)
          if (!product || product.stock === 0) return null
          return { product, quantity: Math.min(line.quantity, product.stock) }
        })
        .filter(Boolean) as { product: Product; quantity: number }[],
    [lines, products]
  )
  const total = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0)

  function changeQuantity(productId: string, quantity: number) {
    setQuantity(productId, quantity)
  }

  function validate() {
    if (!customer.name.trim() || !customer.email.trim() || !customer.address.trim()) { setMessage('Add your name, email, and delivery address to continue.'); return false }
    if (!account) { setMessage('Sign in to place your order - your build list is saved automatically.'); return false }
    if (!items.length) { setMessage('Your build list has no purchasable items.'); return false }
    return true
  }

  async function payCod() {
    if (!validate()) return
    setBusy(true); setMessage('Placing your order...')
    const response = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: 'cod', items: items.map(({ product, quantity }) => ({ productId: product.id, name: product.name, price: product.price, quantity })), customer }) })
    const result = await response.json()
    if (result.ok && result.order?.id) { clear(); window.location.href = `/checkout/success?order=${result.order.id}` }
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
      if (provider === 'esewa' && result.action && result.fields) { clear(); submitGatewayForm(result.action, result.fields); return }
      setMessage(result.error || `${provider} is not configured yet.`); setBusy(false)
    } catch {
      setMessage(`${provider === 'esewa' ? 'eSewa' : 'Khalti'} payment could not be started. Try again.`); setBusy(false)
    }
  }

  const inputClass = 'w-full border border-line bg-mist px-4 py-3 text-sm outline-none transition focus:border-cobalt'
  const labelClass = 'block text-xs font-bold uppercase tracking-wide text-slate-500'

  return (
    <main className="min-h-screen bg-mist">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
          <Link href="/" className="flex items-center gap-3" aria-label="GENUM SOLUTIONS home">
            <Image src="/logo.png" alt="GENUM SOLUTIONS stamp" width={48} height={48} className="h-11 w-11 object-contain" />
            <span className="font-display text-lg font-bold">GENUM checkout</span>
          </Link>
          <div className="flex items-center gap-5">
            <Link href="/products" className="text-sm font-bold text-cobalt hover:underline">Continue shopping</Link>
            {account && <Link href="/account" className="text-sm font-bold text-cobalt hover:underline">My account</Link>}
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-5 py-12 lg:px-8">
        <p className="text-xs font-black uppercase tracking-[.24em] text-cobalt">Secure order</p>
        <h1 className="mt-3 font-display text-4xl font-bold tracking-tight sm:text-5xl">Ready to build?</h1>
        {!account && hydrated && lines.length > 0 && (
          <div className="mt-6 rounded-2xl border border-cobalt bg-white p-5 text-sm text-slate-700">
            <strong className="text-ink">Sign in to place your order.</strong> Your build list is already saved and will merge into your account.{' '}
            <Link href="/login" className="font-bold text-cobalt underline">Sign in or create an account</Link>
          </div>
        )}
        {!hydrated ? (
          <div className="mt-10 animate-pulse rounded-2xl border border-line bg-white p-12 text-center text-sm font-bold text-slate-400" role="status">Loading your build list...</div>
        ) : items.length === 0 && lines.length > 0 ? (
          <div className="mt-10 rounded-2xl border border-dashed border-signal bg-white p-8 text-center">
            <h2 className="font-display text-xl font-bold">Some items in your build list are no longer available.</h2>
            <p className="mt-2 text-sm text-slate-500">They were removed because they are out of stock or no longer listed.</p>
            <Link href="/products" className="mt-5 inline-block rounded-full bg-cobalt px-5 py-3 text-sm font-black text-white transition hover:bg-blue-800">Browse alternatives</Link>
          </div>
        ) : items.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-dashed border-line bg-white p-12 text-center">
            <h2 className="font-display text-2xl font-bold">Your build list is empty.</h2>
            <Link href="/products" className="mt-5 inline-block rounded-full bg-cobalt px-5 py-3 text-sm font-black text-white transition hover:bg-blue-800">Browse products</Link>
          </div>
        ) : (
          <div className="mt-10 grid gap-10 lg:grid-cols-[1.1fr_.9fr]">
            <section aria-labelledby="delivery-heading" className="rounded-2xl border border-line bg-white p-6">
              <h2 id="delivery-heading" className="font-display text-2xl font-bold">Delivery details</h2>
              <form className="mt-6 grid gap-3 sm:grid-cols-2" onSubmit={(event) => event.preventDefault()}>
                <label className={`${labelClass} sm:col-span-2`}>Full name
                  <input value={customer.name} onChange={(event) => setCustomer({ ...customer, name: event.target.value })} autoComplete="name" required className={`mt-2 ${inputClass}`} />
                </label>
                <label className={labelClass}>Email
                  <input value={customer.email} onChange={(event) => setCustomer({ ...customer, email: event.target.value })} type="email" autoComplete="email" required className={`mt-2 ${inputClass}`} />
                </label>
                <label className={labelClass}>Phone
                  <input value={customer.phone} onChange={(event) => setCustomer({ ...customer, phone: event.target.value })} type="tel" autoComplete="tel" className={`mt-2 ${inputClass}`} />
                </label>
                <label className={`${labelClass} sm:col-span-2`}>Delivery address in Nepal
                  <textarea value={customer.address} onChange={(event) => setCustomer({ ...customer, address: event.target.value })} rows={3} autoComplete="street-address" required className={`mt-2 ${inputClass}`} />
                </label>
              </form>
              <p className="mt-4 text-xs leading-5 text-slate-500">Free Kathmandu delivery on orders above NPR 5,000. We confirm every order by email before dispatch.</p>
            </section>
            <section aria-label="Order summary and payment" className="space-y-4">
              <div className="rounded-2xl border border-line bg-white p-6">
                <h2 className="mb-2 font-display text-lg font-bold">Build list ({items.length})</h2>
                {items.map(({ product, quantity }) => (
                  <div key={product.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-3 last:border-b-0 last:pb-0 first:pt-0">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{product.name}</p>
                      <p className="text-xs text-slate-500">{formatNPR(product.price)} each · {product.stock} in stock</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => changeQuantity(product.id, quantity - 1)} className="h-8 w-8 border border-line font-black transition hover:border-cobalt hover:text-cobalt disabled:opacity-40" disabled={quantity <= 1} aria-label={`Reduce ${product.name} quantity`}>−</button>
                      <span className="w-6 text-center text-sm font-bold" aria-live="polite">{quantity}</span>
                      <button onClick={() => changeQuantity(product.id, Math.min(quantity + 1, product.stock))} disabled={quantity >= product.stock} className="h-8 w-8 border border-line font-black transition hover:border-cobalt hover:text-cobalt disabled:opacity-40" aria-label={`Add another ${product.name}`}>+</button>
                      <button onClick={() => changeQuantity(product.id, 0)} className="ml-1 text-xs font-bold text-red-600 underline" aria-label={`Remove ${product.name} from build list`}>Remove</button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="rounded-2xl border-t-4 border-ink bg-white p-6">
                <div className="flex items-center justify-between text-lg font-black"><span>Total</span><span>{formatNPR(total)}</span></div>
                <div className="mt-5 grid gap-3">
                  <button onClick={() => payNepal('esewa')} disabled={busy} className="bg-cobalt px-5 py-3.5 text-sm font-black text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60">Pay with eSewa</button>
                  <button onClick={() => payNepal('khalti')} disabled={busy} className="bg-cobalt px-5 py-3.5 text-sm font-black text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60">Pay with Khalti</button>
                  <button onClick={payCod} disabled={busy} className="border-2 border-dashed border-line px-5 py-3.5 text-sm font-black text-slate-600 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60">Reserve order · Pay on delivery</button>
                </div>
                <div role="status" aria-live="polite">{message && <p className="mt-4 text-sm font-bold text-signal">{message}</p>}</div>
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  )
}
