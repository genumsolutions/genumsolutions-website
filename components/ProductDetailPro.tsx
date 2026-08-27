'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowUpRight, Check } from 'lucide-react'
import { RoboticArm } from './Robotics3D'
import { useCart } from './cart-provider'
import type { Product } from '../lib/catalog'

export default function ProductDetailPro({ product }: { product: Product }) {
  const [quantity, setQuantity] = useState(1)
  const [added, setAdded] = useState(false)
  const { add } = useCart()
  const isQuote = product.productType === 'Project package' || product.stock === 0

  useEffect(() => {
    if (!added) return
    const timer = window.setTimeout(() => setAdded(false), 2000)
    return () => window.clearTimeout(timer)
  }, [added])

  function addToBuildList() {
    if (isQuote) return
    add(product.id, Math.min(quantity, product.stock))
    setAdded(true)
  }

  return (
    <div className="min-h-screen bg-mist">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-5 sm:py-8 lg:px-8">
        <Link href="/products" className="inline-flex items-center gap-1.5 text-sm font-bold text-navy transition hover:text-navy-dark">
          <ArrowLeft size={15} aria-hidden="true" /> Back to the shop
        </Link>
        <div className="mt-6 grid gap-8 sm:mt-8 sm:gap-10 lg:grid-cols-[.9fr_1.1fr] lg:items-start">
          <div className="relative aspect-square overflow-hidden rounded-2xl bg-ink sm:rounded-3xl">
            <Image
              src={product.image || '/placeholder.jpg'}
              alt={product.name}
              fill
              priority
              className="object-cover"
            />
            <RoboticArm />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[.24em] text-navy">
              {product.category} · {product.badge || product.productType}
            </p>
            <h1 className="mt-3 font-display text-2xl font-bold leading-none tracking-[-.03em] text-ink sm:text-3xl sm:leading-tight lg:text-5xl">
              {product.name}
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-muted sm:mt-5 sm:text-lg">
              {product.description}
            </p>
            <div className="mt-7 flex flex-wrap items-baseline gap-3">
              <span className="font-display text-3xl font-bold">{product.priceLabel}</span>
              <span className="text-sm text-muted">
                {product.productType === 'Project package' ? 'indicative package' : 'per unit'}
              </span>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              {!isQuote && (
                <div className="flex items-center rounded-full border border-line bg-white shadow-sm">
                  <button onClick={() => setQuantity((value) => Math.max(1, value - 1))} className="h-11 w-11 rounded-l-full text-lg font-bold transition hover:bg-mist" aria-label={`Decrease quantity of ${product.name}`}>−</button>
                  <span className="w-8 text-center text-sm font-bold" aria-live="polite" aria-label={`Quantity: ${quantity}`}>{quantity}</span>
                  <button onClick={() => setQuantity((value) => Math.min(product.stock, value + 1))} className="h-11 w-11 rounded-r-full text-lg font-bold transition hover:bg-mist" aria-label={`Increase quantity of ${product.name}`}>+</button>
                </div>
              )}
              <Link
                href={isQuote ? '/contact' : '/checkout'}
                onClick={isQuote ? undefined : addToBuildList}
                className={`rounded-full px-6 py-3.5 text-sm font-black text-white transition ${added ? 'bg-emerald-600' : 'bg-navy hover:bg-navy-dark'}`}
                aria-label={isQuote ? `Request a quote for ${product.name}` : added ? `${product.name} added to build list` : `Add ${product.name} to build list`}>
                <span className="inline-flex items-center gap-1.5">
                  {isQuote ? 'Request a scoped quote' : added ? 'Added to build list' : 'Add to build list'}
                  {isQuote ? <ArrowUpRight size={15} aria-hidden="true" /> : added ? <Check size={15} aria-hidden="true" /> : null}
                </span>
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-10 grid gap-4 border-y border-line py-6 sm:grid-cols-2">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-navy">Audience</p>
            <p className="mt-2 text-sm leading-6 text-muted">
              {product.audience}
            </p>
            <p className="mt-2 text-sm leading-6 text-muted">
              {product.difficulty}
            </p>
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-navy">Warranty</p>
            <p className="mt-2 text-sm leading-6 text-muted">
              {product.warranty}
            </p>
          </div>
        </div>

        <div className="mt-10 grid gap-4 border-t-2 border-line py-6 sm:grid-cols-2">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-navy">Color</p>
            <p className="mt-2 text-sm leading-6 text-muted">
              {product.color ? product.color.replace(/from-\[.*?\]\s*to-\[.*?\]/, 'Standard finish') : 'Standard finish'}
            </p>
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-navy">Delivery</p>
            <p className="mt-2 text-sm leading-6 text-muted">
              {product.delivery}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}