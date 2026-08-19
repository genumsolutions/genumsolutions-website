'use client'

import Image from 'next/image'
import { useState } from 'react'
import { formatNPR, products, type Product } from '../lib/catalog'
import ThemeToggle from './ThemeToggle'

const nav = [
  { label: 'About', href: '/about' },
  { label: 'Services', href: '/services' },
  { label: 'Products', href: '/products' },
  { label: '3D Printing', href: '/3d-printing' },
  { label: 'Training', href: '/training' },
  { label: 'Portfolio', href: '/portfolio' },
  { label: 'Journal', href: '/journal' },
]

function ProductVisual({ product }: { product: Product }) {
  return <div className={`relative flex h-52 items-center justify-center overflow-hidden bg-gradient-to-br ${product.color}`}>
    <div className="absolute right-4 top-4 h-24 w-24 rounded-full border border-white/60" />
    <div className="absolute bottom-[-35px] left-[-10px] h-32 w-32 rounded-full border-[18px] border-white/30" />
    <div className="relative flex h-24 w-24 rotate-[-10deg] items-center justify-center rounded-[28px] border-4 border-ink bg-white/80 text-4xl shadow-xl">{product.category === 'Robotics' ? '◉' : product.category === 'Electronics' ? '⌁' : product.category === 'Learning' ? '✦' : '⚙'}</div>
  </div>
}

export default function Storefront() {
  const [cart, setCart] = useState<Product[]>([])
  const [menuOpen, setMenuOpen] = useState(false)
  const [cartOpen, setCartOpen] = useState(false)
  const [checkoutMessage, setCheckoutMessage] = useState('')
  const addToCart = (product: Product) => {
    if (product.productType === 'Project package') {
      window.location.href = `/products/${product.id}`
      return
    }
    setCart((current) => [...current, product])
  }
  const removeFromCart = (productId: string) => setCart((current) => {
    const index = current.findIndex((product) => product.id === productId)
    return index === -1 ? current : current.filter((_, itemIndex) => itemIndex !== index)
  })
  const total = cart.reduce((sum, item) => sum + item.price, 0)
  const startCheckout = async (provider: 'stripe' | 'esewa' | 'khalti') => {
    setCheckoutMessage('Preparing secure checkout...')
    const grouped = products.filter((product) => cart.some((item) => item.id === product.id)).map((product) => ({ ...product, quantity: cart.filter((item) => item.id === product.id).length }))
    const endpoint = provider === 'stripe' ? '/api/checkout/stripe' : '/api/checkout/nepal'
    const payload = provider === 'stripe' ? { items: grouped } : { provider, items: grouped }
    const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const result = await response.json()
    if (result.url) window.location.href = result.url
    else setCheckoutMessage(result.message || result.error || 'Checkout is not configured yet.')
  }

  return <main><div className="fixed right-24 top-4 z-40"><ThemeToggle /></div>
    <header className="border-b border-line bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
        <a href="#top" className="flex items-center gap-3">
          <Image src="/logo.png" alt="GENUM SOLUTIONS PVT. LTD. stamp" width={55} height={55} className="h-12 w-12 object-contain" priority />
          <div className="leading-none"><span className="font-display text-lg font-bold tracking-tight text-ink">GENUM</span><span className="block text-[9px] font-bold uppercase tracking-[.28em] text-cobalt">Solutions Pvt. Ltd.</span></div>
        </a>
        <nav className="hidden items-center gap-7 text-sm font-bold text-slate-500 lg:flex">{nav.map((item) => <a key={item.label} href={item.href} className="hover:text-cobalt">{item.label}</a>)}</nav>
        <div className="flex items-center gap-3"><button className="hidden text-sm font-bold text-ink sm:block">Sign in</button><button onClick={() => setCartOpen(true)} aria-label="Open cart" className="relative flex h-11 w-11 items-center justify-center rounded-full bg-ink text-lg text-white">⌑{cart.length > 0 && <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-signal text-[10px] font-black text-ink">{cart.length}</span>}</button><button onClick={() => setMenuOpen(!menuOpen)} className="rounded-full border border-line px-4 py-2 text-sm font-bold text-ink lg:hidden">Menu</button></div>
      </div>
      {menuOpen && <div className="border-t border-line px-5 py-4 lg:hidden"><div className="flex flex-wrap gap-4 text-sm font-bold">{nav.map((item) => <a key={item.label} href={item.href} onClick={() => setMenuOpen(false)}>{item.label}</a>)}</div></div>}
    </header>

    {cartOpen && <div className="fixed inset-0 z-50 bg-ink/30" onClick={() => setCartOpen(false)}><aside className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}><div className="flex items-center justify-between border-b border-line pb-5"><div><p className="text-xs font-black uppercase tracking-widest text-cobalt">Your build list</p><h2 className="mt-1 font-display text-2xl font-bold">Cart ({cart.length})</h2></div><button onClick={() => setCartOpen(false)} aria-label="Close cart" className="text-2xl text-slate-400 hover:text-ink">×</button></div>{cart.length === 0 ? <div className="flex flex-1 flex-col items-center justify-center text-center"><p className="font-display text-xl font-bold">Nothing on the bench yet.</p><p className="mt-2 text-sm text-slate-500">Add a kit and we’ll get your build moving.</p><button onClick={() => setCartOpen(false)} className="mt-6 rounded-full bg-cobalt px-5 py-3 text-sm font-black text-white">Browse kits</button></div> : <><div className="flex-1 space-y-4 overflow-y-auto py-6">{cart.map((item, index) => <div key={`${item.id}-${index}`} className="flex items-center justify-between gap-4 border-b border-line pb-4"><div><p className="font-bold">{item.name}</p><p className="mt-1 text-xs text-slate-500">{formatNPR(item.price)}</p></div><button onClick={() => removeFromCart(item.id)} className="text-xs font-bold text-cobalt underline underline-offset-4">Remove</button></div>)}</div><div className="border-t border-line pt-5"><div className="flex items-center justify-between font-display text-xl font-bold"><span>Total</span><span>{formatNPR(total)}</span></div><div className="mt-4 grid gap-2"><button onClick={() => startCheckout('stripe')} className="rounded-lg bg-cobalt py-3 text-sm font-black text-white hover:bg-ink">Pay with Stripe</button><div className="grid grid-cols-2 gap-2"><button onClick={() => startCheckout('esewa')} className="rounded-lg border border-line py-3 text-xs font-black text-ink hover:border-cobalt">eSewa</button><button onClick={() => startCheckout('khalti')} className="rounded-lg border border-line py-3 text-xs font-black text-ink hover:border-cobalt">Khalti</button></div></div>{checkoutMessage && <p className="mt-3 text-center text-xs text-slate-500">{checkoutMessage}</p>}</div></>}</aside></div>}

    <section id="top" className="grid-paper overflow-hidden border-b border-line"><div className="mx-auto grid max-w-7xl items-center gap-10 px-5 py-16 lg:grid-cols-[1.15fr_.85fr] lg:px-8 lg:py-24">
      <div><p className="mb-5 flex items-center gap-2 text-xs font-black uppercase tracking-[.24em] text-cobalt"><span className="h-2 w-2 rounded-full bg-signal" /> Kathmandu · Nepal</p><h1 className="max-w-3xl font-display text-5xl font-bold leading-[.98] tracking-[-.04em] text-ink sm:text-7xl">Technology you can <span className="text-cobalt">touch,</span> test, and trust.</h1><p className="mt-7 max-w-xl text-base leading-7 text-slate-600">Robotics kits, digital products, and training designed for curious builders. From first circuit to real-world launch.</p><div className="mt-9 flex flex-wrap items-center gap-4"><a href="#products" className="rounded-full bg-cobalt px-6 py-3.5 text-sm font-black text-white shadow-lg shadow-cobalt/20 hover:bg-ink">Explore the shop <span className="ml-2">↗</span></a><a href="#training" className="rounded-full border border-ink/20 bg-white/70 px-6 py-3.5 text-sm font-black text-ink hover:border-cobalt hover:text-cobalt">Join a workshop</a></div><div className="mt-12 flex gap-8 border-t border-ink/10 pt-5"><div><strong className="font-display text-2xl">26+</strong><span className="mt-1 block text-xs text-slate-500">projects shipped</span></div><div><strong className="font-display text-2xl">1,200</strong><span className="mt-1 block text-xs text-slate-500">builders trained</span></div><div><strong className="font-display text-2xl">4.9/5</strong><span className="mt-1 block text-xs text-slate-500">community rating</span></div></div></div>
      <div className="relative mx-auto w-full max-w-[420px]"><div className="stamp-ring relative aspect-square overflow-hidden rounded-full border-[10px] border-white bg-white"><Image src="/logo.png" alt="GENUM official stamp" fill sizes="(max-width: 768px) 80vw, 420px" className="object-contain p-2" priority /></div><div className="absolute -bottom-3 -left-5 rotate-[-5deg] rounded-2xl border border-ink/10 bg-white px-4 py-3 shadow-xl"><span className="block text-[10px] font-black uppercase tracking-widest text-cobalt">Made in Nepal</span><span className="font-display text-xl font-bold">Build forward.</span></div></div>
    </div></section>

    <section id="products" className="mx-auto max-w-7xl px-5 py-16 lg:px-8"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.24em] text-cobalt">The workshop shelf</p><h2 className="mt-2 font-display text-4xl font-bold tracking-tight">Pick a project.</h2></div><a href="/products" className="text-sm font-black text-cobalt underline decoration-signal decoration-2 underline-offset-4">View all products ↗</a></div><div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{products.map((product) => <article key={product.id} className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm"><div className="relative">{product.badge && <span className="absolute left-3 top-3 z-10 rounded-full bg-ink px-3 py-1 text-[10px] font-black uppercase tracking-wider text-white">{product.badge}</span>}<ProductVisual product={product} /></div><div className="p-5"><p className="text-[10px] font-black uppercase tracking-widest text-cobalt">{product.category}</p><h3 className="mt-2 font-display text-xl font-bold">{product.name}</h3><p className="mt-1 text-sm text-slate-500">{product.note}</p><div className="mt-5 flex items-center justify-between"><span className="font-display text-lg font-bold">{formatNPR(product.price)}</span><button onClick={() => { addToCart(product); setCartOpen(true) }} aria-label={`Add ${product.name} to cart`} className="flex h-10 w-10 items-center justify-center rounded-full bg-sky text-xl font-bold text-cobalt hover:bg-cobalt hover:text-white">+</button></div></div></article>)}</div></section>

    <section id="services" className="bg-ink text-white"><div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 lg:grid-cols-[.8fr_1.2fr] lg:px-8"><div><p className="text-xs font-black uppercase tracking-[.24em] text-signal">Beyond the box</p><h2 className="mt-3 max-w-sm font-display text-4xl font-bold tracking-tight">Ideas deserve a good build partner.</h2><p className="mt-5 max-w-sm text-sm leading-7 text-blue-100/70">A small, focused team for the moments when off-the-shelf just won’t do.</p><a href="#contact" className="mt-8 inline-block rounded-full bg-signal px-5 py-3 text-sm font-black text-ink">Start a conversation ↗</a></div><div className="grid gap-3 sm:grid-cols-3"><div className="border-t border-white/20 pt-4"><span className="font-display text-3xl text-signal">01</span><h3 className="mt-8 font-bold">Build a brand</h3><p className="mt-2 text-sm leading-6 text-blue-100/60">Websites that make your best work easy to find.</p></div><div className="border-t border-white/20 pt-4"><span className="font-display text-3xl text-signal">02</span><h3 className="mt-8 font-bold">Ship a system</h3><p className="mt-2 text-sm leading-6 text-blue-100/60">E-commerce, dashboards, and tools made for momentum.</p></div><div className="border-t border-white/20 pt-4"><span className="font-display text-3xl text-signal">03</span><h3 className="mt-8 font-bold">Teach the next</h3><p className="mt-2 text-sm leading-6 text-blue-100/60">Practical sessions for schools, teams, and makers.</p></div></div></div></section>

    <section id="training" className="mx-auto grid max-w-7xl gap-10 px-5 py-16 lg:grid-cols-[1fr_1fr] lg:px-8"><div><p className="text-xs font-black uppercase tracking-[.24em] text-cobalt">Coming up</p><h2 className="mt-2 font-display text-4xl font-bold tracking-tight">Make time to make.</h2><p className="mt-5 max-w-md leading-7 text-slate-600">Small groups. Real hardware. A patient guide. Our next weekend lab is built for the person who keeps saying, “I should learn this.”</p><div className="mt-8 flex items-center gap-4"><div className="rounded-xl bg-signal px-4 py-3 text-center"><strong className="block font-display text-2xl">12</strong><span className="text-[10px] font-black uppercase">Oct</span></div><div><strong className="font-bold">Robotics with ESP32</strong><span className="mt-1 block text-sm text-slate-500">Saturday · 10:00–16:00 · Kathmandu</span></div></div></div><form id="contact" className="rounded-2xl border border-line bg-white p-6 shadow-sm"><h3 className="font-display text-2xl font-bold">Reserve your seat</h3><p className="mt-1 text-sm text-slate-500">We’ll send the kit list and a warm hello.</p><div className="mt-6 grid gap-3 sm:grid-cols-2"><input className="rounded-lg border border-line bg-mist px-4 py-3 text-sm outline-none focus:border-cobalt sm:col-span-2" placeholder="Your name" /><input className="rounded-lg border border-line bg-mist px-4 py-3 text-sm outline-none focus:border-cobalt" placeholder="Email address" type="email" /><input className="rounded-lg border border-line bg-mist px-4 py-3 text-sm outline-none focus:border-cobalt" placeholder="Phone number" /></div><button type="button" className="mt-4 w-full rounded-lg bg-cobalt py-3.5 text-sm font-black text-white hover:bg-ink">Register interest</button></form></section>

    <footer className="border-t border-line bg-white"><div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-8 text-sm sm:flex-row sm:items-center sm:justify-between lg:px-8"><div className="flex items-center gap-3"><Image src="/logo.png" alt="GENUM stamp" width={38} height={38} className="h-9 w-9 object-contain" /><div><strong className="font-display">GENUM SOLUTIONS</strong><span className="block text-xs text-slate-500">Shringhkhala Galli-32, Kathmandu, Nepal</span></div></div><div className="flex gap-5 text-xs font-bold text-slate-500"><a href="/services">Services</a><a href="/products">Shop</a><a href="/3d-printing">3D Printing</a><a href="/contact">Contact</a><span>© 2026</span></div></div></footer>
  </main>
}
