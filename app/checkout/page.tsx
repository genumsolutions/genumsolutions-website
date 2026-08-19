'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { findProduct, formatNPR, products } from '../../lib/catalog'

type CartLine = { productId: string; quantity: number }

export default function CheckoutPage() {
  const [lines, setLines] = useState<CartLine[]>([])
  const [message, setMessage] = useState('')
  const [customer, setCustomer] = useState({ name: '', email: '', phone: '', address: '' })
  useEffect(() => { setLines(JSON.parse(window.localStorage.getItem('genum-cart') || '[]')) }, [])
  const items = useMemo(() => lines.map((line) => { const product = findProduct(line.productId); return product ? { product, quantity: line.quantity } : null }).filter(Boolean) as { product: typeof products[number]; quantity: number }[], [lines])
  const total = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0)

  function changeQuantity(productId: string, quantity: number) {
    const next = lines.map((line) => line.productId === productId ? { ...line, quantity } : line).filter((line) => line.quantity > 0)
    setLines(next)
    window.localStorage.setItem('genum-cart', JSON.stringify(next))
  }

  async function pay(provider: 'stripe' | 'esewa' | 'khalti') {
    if (!customer.name || !customer.email || !customer.address) { setMessage('Add your name, email, and delivery address to continue.'); return }
    setMessage('Preparing secure checkout...')
    const endpoint = provider === 'stripe' ? '/api/checkout/stripe' : '/api/checkout/nepal'
    const payload = { items: items.map(({ product, quantity }) => ({ ...product, quantity })), customer, ...(provider === 'stripe' ? {} : { provider }) }
    const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const result = await response.json()
    if (result.url) window.location.href = result.url
    else setMessage(result.message || result.error || 'Payment setup is not configured yet.')
  }

  return <main className="min-h-screen bg-mist"><header className="border-b border-line bg-white"><div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8"><Link href="/" className="flex items-center gap-3"><Image src="/logo.png" alt="GENUM stamp" width={48} height={48} className="h-11 w-11 object-contain" /><span className="font-display text-lg font-bold">GENUM checkout</span></Link><Link href="/products" className="text-sm font-bold text-cobalt">Continue shopping</Link></div></header><div className="mx-auto max-w-7xl px-5 py-12 lg:px-8"><p className="text-xs font-black uppercase tracking-[.24em] text-cobalt">Secure order</p><h1 className="mt-3 font-display text-5xl font-bold tracking-[-.04em]">Ready to build?</h1>{items.length === 0 ? <div className="mt-10 rounded-2xl border border-dashed border-line bg-white p-12 text-center"><h2 className="font-display text-2xl font-bold">Your build list is empty.</h2><Link href="/products" className="mt-5 inline-block rounded-full bg-cobalt px-5 py-3 text-sm font-black text-white">Browse products</Link></div> : <div className="mt-10 grid gap-10 lg:grid-cols-[1.1fr_.9fr]"><section className="rounded-2xl border border-line bg-white p-6"><h2 className="font-display text-2xl font-bold">Delivery details</h2><div className="mt-6 grid gap-3 sm:grid-cols-2"><input value={customer.name} onChange={(event) => setCustomer({ ...customer, name: event.target.value })} className="border border-line bg-mist px-4 py-3 text-sm sm:col-span-2" placeholder="Full name" /><input value={customer.email} onChange={(event) => setCustomer({ ...customer, email: event.target.value })} className="border border-line bg-mist px-4 py-3 text-sm" placeholder="Email" type="email" /><input value={customer.phone} onChange={(event) => setCustomer({ ...customer, phone: event.target.value })} className="border border-line bg-mist px-4 py-3 text-sm" placeholder="Phone" /><textarea value={customer.address} onChange={(event) => setCustomer({ ...customer, address: event.target.value })} className="min-h-28 border border-line bg-mist px-4 py-3 text-sm sm:col-span-2" placeholder="Delivery address in Nepal" /></div></section><aside className="rounded-2xl bg-ink p-6 text-white"><h2 className="font-display text-2xl font-bold">Your order</h2><div className="mt-6 space-y-4">{items.map(({ product, quantity }) => <div key={product.id} className="flex items-center justify-between gap-4 border-b border-white/15 pb-4"><div><p className="font-bold">{product.name}</p><p className="mt-1 text-xs text-blue-100/60">{formatNPR(product.price)} × {quantity}</p></div><div className="flex items-center gap-2"><button onClick={() => changeQuantity(product.id, quantity - 1)} className="h-7 w-7 rounded-full border border-white/20">−</button><span className="text-sm">{quantity}</span><button onClick={() => changeQuantity(product.id, quantity + 1)} className="h-7 w-7 rounded-full border border-white/20">+</button></div></div>)}</div><div className="mt-6 flex justify-between font-display text-2xl font-bold"><span>Total</span><span>{formatNPR(total)}</span></div><p className="mt-2 text-xs text-blue-100/60">Shipping confirmed before dispatch. Free Kathmandu delivery over NPR 5,000.</p><div className="mt-7 grid gap-2"><button onClick={() => pay('stripe')} className="rounded-lg bg-signal py-3 font-black text-ink">Pay with Stripe</button><div className="grid grid-cols-2 gap-2"><button onClick={() => pay('esewa')} className="rounded-lg border border-white/20 py-3 text-sm font-black">eSewa</button><button onClick={() => pay('khalti')} className="rounded-lg border border-white/20 py-3 text-sm font-black">Khalti</button></div></div>{message && <p className="mt-4 text-center text-xs text-blue-100/70">{message}</p>}</aside></div>}</div></main>
}
