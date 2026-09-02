'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { formatNPR, type Product } from '../../lib/catalog'
import { inputClass } from '../../lib/styles'
import { useCart } from '../../components/cart-provider'

export default function CheckoutPage() {
  const { lines, setQuantity, clear, hydrated } = useCart()
  const [products, setProducts] = useState<Product[]>([])
  const [productsState, setProductsState] = useState<'loading' | 'ready' | 'failed'>('loading')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [customer, setCustomer] = useState({ name: '', email: '', phone: '', address: '' })
  const [account, setAccount] = useState<{ name: string; email: string } | null>(null)

  useEffect(() => {
    fetch('/api/products')
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data) => { setProducts(data); setProductsState('ready') })
      .catch(() => setProductsState('failed'))
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
      if (provider === 'khalti' && result.url) { clear(); window.location.href = result.url; return }
      if (provider === 'esewa' && result.action && result.fields) { clear(); submitGatewayForm(result.action, result.fields); return }
      setMessage(result.error || `${provider} is not configured yet.`); setBusy(false)
    } catch {
      setMessage(`${provider === 'esewa' ? 'eSewa' : 'Khalti'} payment could not be started. Try again.`); setBusy(false)
    }
  }

  const labelClass = 'block text-xs font-bold uppercase tracking-wide text-muted'

  return (
    <main className="min-h-screen bg-mist">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-5 py-3 lg:px-8 lg:py-4">
          <Link href="/" className="group flex min-w-0 shrink items-center gap-2.5 sm:gap-3" aria-label="GENUM SOLUTIONS home">
            <span className="relative block h-9 w-9 shrink-0 overflow-hidden rounded-full bg-white shadow-card ring-1 ring-line transition group-hover:ring-navy/40 sm:h-11 sm:w-11">
              <Image src="/logo.png" alt="GENUM SOLUTIONS stamp" width={112} height={112} className="h-full w-full object-contain" priority />
            </span>
            <span className="leading-none">
              <strong className="block font-display text-base font-bold tracking-tight text-ink sm:text-[22px]">GENUM</strong>
              <span className="mt-1 hidden text-[9px] font-bold uppercase tracking-[0.32em] text-navy sm:block sm:text-[10px]">Solutions Pvt.&thinsp;Ltd.</span>
            </span>
          </Link>
          <div className="flex shrink-0 items-center gap-2.5 sm:gap-5">
            <Link href="/products" className="text-xs font-bold text-navy hover:underline sm:text-sm">Continue shopping</Link>
            {account && <Link href="/account" className="text-xs font-bold text-navy hover:underline sm:text-sm">My account</Link>}
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-5 py-12 lg:px-8">
        <p className="text-xs font-black uppercase tracking-[.24em] text-navy">Secure order</p>
        <h1 className="mt-3 font-display text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">Ready to build?</h1>
        {!account && hydrated && lines.length > 0 && (
          <div className="mt-6 rounded-2xl border border-navy/20 bg-navy-light p-5 text-sm text-ink">
            <strong>Sign in to place your order.</strong> Your build list is already saved and will merge into your account.{' '}
            <Link href="/login" className="font-bold text-navy transition hover:text-navy-dark">Sign in or create an account</Link>
          </div>
        )}
        {!hydrated ? (
          <div className="mt-10 animate-pulse rounded-2xl border border-line bg-white p-12 text-center text-sm font-bold text-muted" role="status">Loading your build list...</div>
        ) : productsState === 'loading' && lines.length > 0 ? (
          // Wait for the catalog before judging the cart: products resolve the
          // names/prices, so while they load we must NOT show the empty states.
          <div className="mt-10 animate-pulse rounded-2xl border border-line bg-white p-12 text-center text-sm font-bold text-muted" role="status">Loading your build list...</div>
        ) : productsState === 'failed' && lines.length > 0 ? (
          <div className="mt-10 rounded-2xl border border-dashed border-line bg-white p-12 text-center">
            <h2 className="font-display text-xl font-bold">We couldn&rsquo;t load your build list details.</h2>
            <p className="mt-2 text-sm text-muted">Check your connection and try again - your items are saved.</p>
            <Link href="/products" className="mt-5 inline-block rounded-lg bg-navy px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-navy-dark">Back to products</Link>
          </div>
        ) : items.length === 0 && lines.length > 0 ? (
          <div className="mt-10 rounded-2xl border border-dashed border-gold bg-white p-8 text-center">
            <h2 className="font-display text-xl font-bold">Some items in your build list are no longer available.</h2>
            <p className="mt-2 text-sm text-muted">They were removed because they are out of stock or no longer listed.</p>
            <Link href="/products" className="mt-5 inline-block rounded-lg bg-navy px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-navy-dark">Browse alternatives</Link>
          </div>
        ) : items.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-dashed border-line bg-white p-12 text-center">
            <h2 className="font-display text-2xl font-bold">Your build list is empty.</h2>
            <Link href="/products" className="mt-5 inline-block rounded-lg bg-navy px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-navy-dark">Browse products</Link>
          </div>
        ) : (
          <div className="mt-8 grid gap-8 sm:mt-10 sm:gap-10 lg:grid-cols-[1.1fr_.9fr]">
            {/* Items + payment first — the info the customer needs most. */}
            <section aria-label="Order summary and payment" className="space-y-4 lg:order-last">
              <div className="rounded-2xl border border-line bg-white p-6">
                <h2 className="mb-2 font-display text-lg font-bold">Build list ({items.length})</h2>
                {items.map(({ product, quantity }) => (
                  <div key={product.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-3 last:border-b-0 last:pb-0 first:pt-0">
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-bold">{product.name}</p>
                      <p className="truncate text-xs text-muted">{formatNPR(product.price)} each · {product.stock} in stock</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 whitespace-nowrap">
                      <button onClick={() => changeQuantity(product.id, quantity - 1)} className="h-8 w-8 rounded-lg border border-line font-bold transition hover:border-navy hover:text-navy disabled:opacity-40" disabled={quantity <= 1} aria-label={`Reduce ${product.name} quantity`}>−</button>
                      <span className="w-6 text-center text-sm font-bold" aria-live="polite">{quantity}</span>
                      <button onClick={() => changeQuantity(product.id, Math.min(quantity + 1, product.stock))} disabled={quantity >= product.stock} className="h-8 w-8 rounded-lg border border-line font-bold transition hover:border-navy hover:text-navy disabled:opacity-40" aria-label={`Add another ${product.name}`}>+</button>
                      <button onClick={() => changeQuantity(product.id, 0)} className="ml-1 text-xs font-bold text-red-600 underline" aria-label={`Remove ${product.name} from build list`}>Remove</button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="rounded-2xl border-t-4 border-navy bg-white p-6 shadow-card">
                <dl className="space-y-2 text-sm">
                  <div className="flex items-center justify-between"><dt className="text-muted">Subtotal</dt><dd className="font-bold">{formatNPR(total)}</dd></div>
                  <div className="flex items-center justify-between border-t border-line pt-3 text-lg font-black"><dt>Total</dt><dd>{formatNPR(total)}</dd></div>
                </dl>
                <div className="mt-5 hidden gap-3 lg:grid">
                  <button onClick={() => payNepal('esewa')} disabled={busy} className="rounded-lg bg-navy px-5 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-navy-dark disabled:cursor-not-allowed disabled:opacity-60">Pay with eSewa</button>
                  <button onClick={() => payNepal('khalti')} disabled={busy} className="rounded-lg bg-navy px-5 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-navy-dark disabled:cursor-not-allowed disabled:opacity-60">Pay with Khalti</button>
                  <button onClick={payCod} disabled={busy} className="rounded-lg border-2 border-dashed border-line px-5 py-3.5 text-sm font-bold text-muted transition hover:border-ink hover:text-ink disabled:cursor-not-allowed disabled:opacity-60">Reserve order · Pay on delivery</button>
                </div>
                <div role="status" aria-live="polite">{message && <p className="mt-4 text-sm font-bold text-gold">{message}</p>}</div>
              </div>
              {/* Sticky pay bar — keeps Total + payment first and always reachable on mobile. */}
              <div className="sticky bottom-4 z-30 rounded-2xl border border-line bg-white p-4 shadow-card lg:hidden">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-muted">Total</span>
                  <span className="font-display text-xl font-black">{formatNPR(total)}</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button onClick={() => payNepal('esewa')} disabled={busy} className="rounded-lg bg-navy px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-navy-dark disabled:cursor-not-allowed disabled:opacity-60">eSewa</button>
                  <button onClick={() => payNepal('khalti')} disabled={busy} className="rounded-lg bg-navy px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-navy-dark disabled:cursor-not-allowed disabled:opacity-60">Khalti</button>
                </div>
                <button onClick={payCod} disabled={busy} className="mt-2 w-full rounded-lg border-2 border-dashed border-line px-4 py-2.5 text-sm font-bold text-muted transition hover:border-ink hover:text-ink disabled:cursor-not-allowed disabled:opacity-60">Pay on delivery</button>
              </div>
            </section>

            {/* User / delivery details — least needed, so it comes below. */}
            <section aria-labelledby="delivery-heading" className="rounded-2xl border border-line bg-white p-6 lg:order-first">
              <h2 id="delivery-heading" className="font-display text-2xl font-bold">Delivery details</h2>
              <form className="mt-6 grid gap-3 sm:grid-cols-2" onSubmit={(event) => event.preventDefault()}>
                <label className={`${labelClass} sm:col-span-2`}>Full name
                  <input value={customer.name} onChange={(event) => setCustomer({ ...customer, name: event.target.value })} autoComplete="name" required className={`mt-2 w-full ${inputClass}`} />
                </label>
                <label className={labelClass}>Email
                  <input value={customer.email} onChange={(event) => setCustomer({ ...customer, email: event.target.value })} type="email" autoComplete="email" required className={`mt-2 w-full ${inputClass}`} />
                </label>
                <label className={labelClass}>Phone
                  <input value={customer.phone} onChange={(event) => setCustomer({ ...customer, phone: event.target.value })} type="tel" autoComplete="tel" className={`mt-2 w-full ${inputClass}`} />
                </label>
                <label className={`${labelClass} sm:col-span-2`}>Delivery address in Nepal
                  <textarea value={customer.address} onChange={(event) => setCustomer({ ...customer, address: event.target.value })} rows={3} autoComplete="street-address" required className={`mt-2 w-full ${inputClass}`} />
                </label>
              </form>
              <p className="mt-4 text-xs leading-5 text-muted">We confirm every order by email before dispatch.</p>
            </section>
          </div>
        )}
      </div>
    </main>
  )
}
