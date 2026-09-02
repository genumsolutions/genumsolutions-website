'use client'

import { FormEvent, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { inputClass } from '../../lib/styles'
import type { Product } from './admin-types'
import { emptyProduct, fields, PAGE_SIZE } from './admin-types'
import { Pager } from './admin-helpers'

type Props = {
  products: Product[]
  onProductsChange: (updater: (prev: Product[]) => Product[]) => void
  setMessage: (msg: string) => void
}

export default function AdminProducts({ products, onProductsChange, setMessage }: Props) {
  const [product, setProduct] = useState<Product>(emptyProduct)
  const [previewProduct, setPreviewProduct] = useState<Product | null>(null)
  const [query, setQuery] = useState('')
  const [productPage, setProductPage] = useState(1)
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => { setProductPage(1) }, [query])

  const filteredProducts = products.filter((item) => `${item.name} ${item.sku} ${item.id}`.toLowerCase().includes(query.toLowerCase()))
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE))
  const shownProducts = filteredProducts.slice((productPage - 1) * PAGE_SIZE, productPage * PAGE_SIZE)

  function updateProduct(key: keyof Product, value: string | number | string[]) {
    setProduct((current) => ({ ...current, [key]: value }))
  }

  async function saveProduct(event?: FormEvent) {
    event?.preventDefault()
    if (!product.id || !product.name) { setMessage('Give the product at least an id and a name.'); return }
    setBusy(true)
    const payload = { ...product, id: product.id.trim().toLowerCase().replace(/\s+/g, '-'), price: Number(product.price), stock: Number(product.stock), specs: typeof product.specs === 'string' ? String(product.specs).split('\n').filter(Boolean) : product.specs }
    const response = await fetch('/api/admin/products', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) { setMessage(result.error || 'Could not save product.'); setBusy(false); return }
    onProductsChange((current) => [...current.filter((item) => item.id !== payload.id), payload].sort((a, b) => a.name.localeCompare(b.name)))
    setProduct(emptyProduct)
    setMessage('Product saved.')
    setBusy(false)
  }

  async function removeProduct(id: string) {
    if (!window.confirm(`Delete ${id}?`)) return
    const response = await fetch(`/api/admin/products?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    if (response.ok) { onProductsChange((current) => current.filter((item) => item.id !== id)); setMessage('Product deleted.') }
  }

  async function toggleProductVisibility(item: Product) {
    const payload = { ...item, active: item.active === false }
    const response = await fetch('/api/admin/products', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    if (response.ok) { onProductsChange((current) => current.map((p) => p.id === item.id ? payload : p)); setMessage(item.active === false ? 'Product shown.' : 'Product hidden.') }
  }

  async function uploadImage(file: File) {
    setUploading(true); setMessage('')
    const form = new FormData(); form.append('file', file)
    const response = await fetch('/api/admin/upload', { method: 'POST', body: form })
    const result = await response.json().catch(() => ({}))
    if (response.ok && result.url) { setProduct((current) => ({ ...current, image: result.url })); setMessage('Image uploaded.') }
    else setMessage(result.error || 'Upload failed.')
    setUploading(false)
  }

  return (
    <>
      <div role="tabpanel" id="panel-products" aria-labelledby="tab-products" className="mt-8 grid min-w-0 gap-8 xl:grid-cols-[1fr_1.3fr]">
      <section aria-label="Product list" className="min-w-0 space-y-6">
        <div className="min-w-0 border-t-2 border-ink bg-white p-6">
          <h2 className="font-display text-xl font-bold">Products ({filteredProducts.length})</h2>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, SKU, or id" aria-label="Search products" className={`mt-3 w-full ${inputClass}`} />
          <div className="mt-3 divide-y divide-line">
            {shownProducts.map((item) => (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div className="min-w-0 flex-1">
                  <span className="block line-clamp-2 text-sm"><strong>{item.name}</strong> <span className="text-slate-400">{item.sku}</span></span>
                </div>
                <span className="flex shrink-0 flex-wrap gap-2">
                  <button onClick={() => { setProduct(item); document.getElementById('product-editor')?.scrollIntoView({ behavior: 'smooth' }) }} className="text-xs font-bold text-navy underline">Edit</button>
                  <button onClick={() => setPreviewProduct(item)} className="text-xs font-bold text-slate-500 underline">Preview</button>
                  <button onClick={() => void toggleProductVisibility(item)} className="text-xs font-bold text-ink underline">{item.active === false ? 'Show' : 'Hide'}</button>
                  <button onClick={() => removeProduct(item.id)} className="text-xs font-bold text-red-600 underline">Delete</button>
                </span>
              </div>
            ))}
            {shownProducts.length === 0 && <p className="py-3 text-sm text-slate-500">No products match &ldquo;{query}&rdquo;.</p>}
          </div>
          <Pager page={productPage} totalPages={totalPages} onPage={setProductPage} />
        </div>
      </section>
      <section id="product-editor" aria-label="Product editor" className="min-w-0">
        <form onSubmit={saveProduct} className="min-w-0 overflow-hidden border-t-2 border-ink bg-white p-6">
          <h2 className="font-display text-2xl font-bold">{products.some((item) => item.id === product.id) ? `Edit ${product.id}` : 'Add a new product'}</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {fields.map((key) => <label key={key} className="min-w-0 text-sm font-bold capitalize">{key}<input value={String(product[key] ?? '')} onChange={(e) => updateProduct(key, ['price', 'stock'].includes(key) ? Number(e.target.value) : e.target.value)} className={`mt-2 w-full ${inputClass}`} /></label>)}
            <label className="min-w-0 text-sm font-bold sm:col-span-2">Specs, one per line<textarea value={Array.isArray(product.specs) ? product.specs.join('\n') : String(product.specs)} onChange={(e) => updateProduct('specs', e.target.value.split('\n'))} rows={4} className={`mt-2 w-full ${inputClass}`} /></label>
            <div className="min-w-0 sm:col-span-2">
              <p className="text-sm font-bold">Product image</p>
              <div className="mt-2 flex min-w-0 flex-wrap items-center gap-3">
                {product.image && <Image src={product.image} alt={product.name || 'Product preview'} width={64} height={64} className="shrink-0 rounded object-cover" />}
                <input value={product.image || ''} onChange={(e) => updateProduct('image', e.target.value)} placeholder="https://... or upload below" aria-label="Product image URL" className={`min-w-0 flex-1 ${inputClass}`} />
                <input ref={fileInput} type="file" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (file) void uploadImage(file); e.currentTarget.value = '' }} className="hidden" />
                <button type="button" disabled={uploading} onClick={() => fileInput.current?.click()} className="bg-navy px-4 py-2 text-xs font-black text-white disabled:opacity-60">{uploading ? 'Uploading...' : 'Upload'}</button>
              </div>
            </div>
          </div>
          <div className="mt-5 flex gap-3">
            <button type="submit" disabled={busy || uploading} className="bg-gold px-5 py-3 text-sm font-black text-ink transition hover:bg-gold-dark disabled:opacity-60">{busy ? 'Saving...' : 'Save product'}</button>
            {product.id && <button type="button" onClick={() => setProduct(emptyProduct)} className="border border-line px-5 py-3 text-sm font-black text-ink transition hover:border-navy">New product</button>}
          </div>
        </form>
      </section>
    </div>
    {previewProduct && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-5" role="dialog" aria-modal="true" aria-label="Product preview" onClick={() => setPreviewProduct(null)}>
        <article className="relative max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-2xl border border-line bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => setPreviewProduct(null)} className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-ink shadow-sm transition hover:bg-white" aria-label="Close preview">✕</button>
          <div className="relative h-48 overflow-hidden rounded-t-2xl bg-ink">
            {previewProduct.image ? <Image src={previewProduct.image} alt={previewProduct.name} fill className="object-cover" /> : null}
            <div className="absolute inset-0 bg-gradient-to-t from-ink/70 to-transparent" />
            <span className="absolute bottom-3 left-4 max-w-[calc(100%-2rem)] truncate text-xs font-black uppercase tracking-widest text-white">{previewProduct.category}</span>
          </div>
          <div className="flex flex-1 flex-col p-5">
            <p className="truncate text-xs font-black uppercase tracking-widest text-navy">{previewProduct.badge || previewProduct.productType}</p>
            <h2 className="mt-2 line-clamp-2 font-display text-xl font-bold leading-snug text-ink">{previewProduct.name}</h2>
            <p className="mt-2 line-clamp-2 flex-1 text-sm leading-6 text-muted">{previewProduct.note || previewProduct.description}</p>
            <div className="mt-5 flex items-center justify-between gap-3">
              <strong className="font-display text-lg text-ink">{previewProduct.priceLabel}</strong>
              <span className="flex gap-2">
                <a href={`/products/${previewProduct.id}`} target="_blank" rel="noopener noreferrer" className="rounded-full bg-navy px-4 py-2 text-xs font-black text-white transition hover:bg-navy-dark">View page</a>
                <button onClick={() => setPreviewProduct(null)} className="rounded-full border border-line px-4 py-2 text-xs font-black text-ink transition hover:border-navy">Close</button>
              </span>
            </div>
          </div>
        </article>
      </div>
    )}
  </>
  )
}
