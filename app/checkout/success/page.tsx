import Link from 'next/link'

export default function CheckoutSuccessPage() {
  return <main className="grid min-h-screen place-items-center bg-mist px-5"><section className="max-w-lg rounded-2xl border border-line bg-white p-8 text-center shadow-sm"><p className="text-xs font-black uppercase tracking-[.24em] text-cobalt">Order received</p><h1 className="mt-3 font-display text-4xl font-bold">Your build is in motion.</h1><p className="mt-4 leading-7 text-slate-600">We’ve received your payment handoff. GENUM will confirm the order and delivery details by email.</p><div className="mt-7 flex flex-wrap justify-center gap-3"><Link href="/products" className="rounded-full bg-cobalt px-5 py-3 text-sm font-black text-white">Keep exploring</Link><Link href="/" className="rounded-full border border-line px-5 py-3 text-sm font-black text-ink">Back home</Link></div></section></main>
}
