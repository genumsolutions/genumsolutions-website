'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import { formatNPR } from '../../../lib/catalog'

function SuccessPanel() {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('session_id')
  const orderId = searchParams.get('order')
  const provider = searchParams.get('provider')
  const [state, setState] = useState<'checking' | 'confirmed' | 'received'>('checking')
  const [total, setTotal] = useState<number | null>(null)

  useEffect(() => {
    // Clear the guest cart copy now that an order exists.
    window.localStorage.removeItem('genum-cart')
    let endpoint: string | null = null
    if (sessionId) {
      endpoint = `/api/orders/confirm?session_id=${encodeURIComponent(sessionId)}`
    } else if (provider === 'esewa' && searchParams.get('data')) {
      endpoint = `/api/orders/confirm/esewa?data=${encodeURIComponent(searchParams.get('data')!)}`
    } else if (provider === 'khalti' && searchParams.get('pidx')) {
      endpoint = `/api/orders/confirm/khalti?pidx=${encodeURIComponent(searchParams.get('pidx')!)}&purchase_order_id=${encodeURIComponent(searchParams.get('purchase_order_id') || '')}`
    }
    if (!endpoint) {
      setState('received')
      return
    }
    fetch(endpoint)
      .then((response) => response.json())
      .then((data) => {
        if (data.ok && data.matched) {
          setTotal(data.order?.totalNpr ?? null)
          setState('confirmed')
        } else if (data.error === 'Unauthorized') {
          setState('received')
        } else {
          setState('received')
        }
      })
      .catch(() => setState('received'))
  }, [sessionId, provider, searchParams])

  return (
    <section className="max-w-lg rounded-2xl border border-line bg-white p-8 text-center shadow-sm">
      <p className="text-xs font-black uppercase tracking-[.24em] text-navy">Order received</p>
      <h1 className="mt-3 font-display text-4xl font-bold">{state === 'checking' ? 'Confirming payment...' : state === 'confirmed' ? 'Payment confirmed.' : 'Your build is in motion.'}</h1>
      <p className="mt-4 leading-7 text-slate-600">
        {state === 'confirmed' && total !== null
          ? `We received ${formatNPR(total)}. Track this order any time from your account page.`
          : 'GENUM will confirm the order and delivery details by email. You can follow its status in your account.'}
        {orderId ? ` Order reference: ${orderId.slice(0, 8).toUpperCase()}.` : ''}
      </p>
      {(sessionId || provider) && state === 'received' && <p className="mt-2 text-xs text-slate-400">Payment verification is still processing. Your order is saved and will update shortly.</p>}
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Link href="/account" className="rounded-full bg-navy px-5 py-3 text-sm font-black text-white">View my orders</Link>
        <Link href="/products" className="rounded-full border border-line px-5 py-3 text-sm font-black text-ink">Keep exploring</Link>
      </div>
    </section>
  )
}

export default function CheckoutSuccessPage() {
  return (
    <main className="min-h-screen bg-mist">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
          <Link href="/" className="group flex shrink-0 items-center gap-2.5" aria-label="GENUM SOLUTIONS home">
            <span className="relative block h-9 w-9 shrink-0 overflow-hidden rounded-full bg-white shadow-card ring-1 ring-line transition group-hover:ring-navy/40 sm:h-11 sm:w-11">
              <Image src="/logo.png" alt="GENUM SOLUTIONS stamp" width={112} height={112} className="h-full w-full object-contain" priority />
            </span>
            <span className="leading-none">
              <strong className="block font-display text-base font-bold tracking-tight text-ink sm:text-lg">GENUM</strong>
              <span className="mt-0.5 block text-[8px] font-bold uppercase tracking-[0.3em] text-navy sm:text-[9px]">Solutions Pvt.&thinsp;Ltd.</span>
            </span>
          </Link>
          <Link href="/products" className="text-sm font-bold text-navy hover:underline">Continue shopping</Link>
        </div>
      </header>
      <div className="grid min-h-[70vh] place-items-center px-5">
        <Suspense fallback={<div className="font-display text-xl font-bold text-slate-500">Loading...</div>}>
          <SuccessPanel />
        </Suspense>
      </div>
    </main>
  )
}
