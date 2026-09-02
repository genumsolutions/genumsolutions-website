'use client'

import { FormEvent, useState } from 'react'
import Image from 'next/image'
import { inputClass } from '../../lib/styles'
import type { Product } from './admin-types'
import { emptyProduct, PAGE_SIZE } from './admin-types'
import { Pager, focusEditor } from './admin-helpers'

type Props = {
  products: Product[]
  onProductsChange: (updater: (prev: Product[]) => Product[]) => void
  setMessage: (msg: string) => void
}

function ProjectEditor({ product, onChange, onSave, onReset, busy }: {
  product: Product
  onChange: (product: Product) => void
  onSave: (event?: FormEvent) => void
  onReset: () => void
  busy: boolean
}) {
  function setField<K extends keyof Product>(key: K, value: Product[K]) {
    onChange({ ...product, [key]: value })
  }

  const textFields: { key: keyof Product; label: string }[] = [
    { key: 'id', label: 'Project ID' }, { key: 'name', label: 'Project name' },
    { key: 'category', label: 'Category' }, { key: 'sku', label: 'SKU / package code' },
    { key: 'priceLabel', label: 'Price label' }, { key: 'note', label: 'Short summary' },
    { key: 'audience', label: 'Ideal audience' }, { key: 'difficulty', label: 'Difficulty' },
    { key: 'warranty', label: 'Warranty / support' }, { key: 'delivery', label: 'Delivery / lead time' },
  ]

  return (
    <section id="project-package-editor" aria-label="Project package editor" className="min-w-0 border-t-2 border-ink bg-white p-6">
      <form onSubmit={onSave}>
        <h2 className="font-display text-2xl font-bold">{product.id ? `Edit ${product.name}` : 'Add a project package'}</h2>
        <p className="mt-1 text-sm text-muted">These fields are stored in the shared products table and appear on the public project page and native app.</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {textFields.map(({ key, label }) => (
            <label key={key} className="min-w-0 text-sm font-bold">{label}
              <input value={String(product[key] ?? '')} onChange={(event) => setField(key, event.target.value as Product[typeof key])} className={`mt-2 w-full ${inputClass}`} />
            </label>
          ))}
          <label className="text-sm font-bold">Price (NPR)<input type="number" min="0" value={product.price} onChange={(event) => setField('price', Number(event.target.value))} className={`mt-2 w-full ${inputClass}`} /></label>
          <label className="text-sm font-bold">Stock / available units<input type="number" min="0" value={product.stock} onChange={(event) => setField('stock', Number(event.target.value))} className={`mt-2 w-full ${inputClass}`} /></label>
          <label className="sm:col-span-2 text-sm font-bold">Full project description<textarea value={product.description} onChange={(event) => setField('description', event.target.value)} rows={6} className={`mt-2 w-full ${inputClass}`} /></label>
          <label className="sm:col-span-2 text-sm font-bold">Project overview<textarea value={product.projectOverview || ''} onChange={(event) => setField('projectOverview', event.target.value)} rows={4} className={`mt-2 w-full ${inputClass}`} /></label>
          {([
            ['objectives', 'Objectives'], ['materialsRequired', 'Materials required'], ['learningOutcomes', 'Learning outcomes'],
            ['buildSteps', 'Build steps'], ['controlMethods', 'Control methods'], ['prerequisites', 'Prerequisites'], ['deliverables', 'Deliverables'],
          ] as const).map(([key, label]) => (
            <label key={key} className="text-sm font-bold">{label} (one per line)<textarea value={(product[key] || []).join('\n')} onChange={(event) => setField(key, event.target.value.split('\n').filter(Boolean))} rows={4} className={`mt-2 w-full ${inputClass}`} /></label>
          ))}
          <label className="text-sm font-bold">Estimated duration<input value={product.estimatedDuration || ''} onChange={(event) => setField('estimatedDuration', event.target.value)} placeholder="e.g. 2 weeks" className={`mt-2 w-full ${inputClass}`} /></label>
          <label className="text-sm font-bold">Source folder / reference<input value={product.sourceFolder || ''} onChange={(event) => setField('sourceFolder', event.target.value)} className={`mt-2 w-full ${inputClass}`} /></label>
          <label className="text-sm font-bold">Documentation URL<input value={product.documentationUrl || ''} onChange={(event) => setField('documentationUrl', event.target.value)} className={`mt-2 w-full ${inputClass}`} /></label>
          <label className="text-sm font-bold">Video URL<input value={product.videoUrl || ''} onChange={(event) => setField('videoUrl', event.target.value)} className={`mt-2 w-full ${inputClass}`} /></label>
          <label className="sm:col-span-2 text-sm font-bold">Maintenance and safety notes<textarea value={product.maintenanceNotes || ''} onChange={(event) => setField('maintenanceNotes', event.target.value)} rows={4} className={`mt-2 w-full ${inputClass}`} /></label>
          <label className="sm:col-span-2 text-sm font-bold">Components, technologies, and deliverables (one per line)<textarea value={product.specs.join('\n')} onChange={(event) => setField('specs', event.target.value.split('\n').filter(Boolean))} rows={6} className={`mt-2 w-full ${inputClass}`} /></label>
          <label className="sm:col-span-2 text-sm font-bold">Image URL<input value={product.image || ''} onChange={(event) => setField('image', event.target.value)} placeholder="Supabase Storage or public image URL" className={`mt-2 w-full ${inputClass}`} /></label>
          <label className="flex items-center gap-2 text-sm font-bold sm:col-span-2"><input type="checkbox" checked={product.active !== false} onChange={(event) => setField('active', event.target.checked)} /> Visible to customers</label>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <button type="submit" disabled={busy} className="bg-gold px-5 py-3 text-sm font-black text-ink disabled:opacity-60">{busy ? 'Saving...' : 'Save project package'}</button>
          <button type="button" onClick={onReset} className="border border-line px-5 py-3 text-sm font-black text-ink">New project</button>
        </div>
      </form>
    </section>
  )
}

export default function AdminProjectPackages({ products, onProductsChange, setMessage }: Props) {
  const [product, setProduct] = useState<Product>(emptyProduct)
  const [previewProduct, setPreviewProduct] = useState<Product | null>(null)
  const [projectCategory, setProjectCategory] = useState('All')
  const [projectQuery, setProjectQuery] = useState('')
  const [projectPage, setProjectPage] = useState(1)
  const [busy, setBusy] = useState(false)

  const projectProducts = products.filter((item) => item.productType === 'Project package')
  const projectCategories = Array.from(new Set(projectProducts.map((item) => item.category)))
  const filteredProjects = projectProducts.filter((item) => {
    const matchesCategory = projectCategory === 'All' || item.category === projectCategory
    const needle = projectQuery.trim().toLowerCase()
    return matchesCategory && (!needle || `${item.name} ${item.sku} ${item.id} ${item.description}`.toLowerCase().includes(needle))
  })
  const totalPages = Math.max(1, Math.ceil(filteredProjects.length / PAGE_SIZE))
  const shownProjects = filteredProjects.slice((projectPage - 1) * PAGE_SIZE, projectPage * PAGE_SIZE)

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
    if (response.ok) onProductsChange((current) => current.map((p) => p.id === item.id ? payload : p))
  }

  return (
    <>
      <div role="tabpanel" id="panel-project-packages" aria-labelledby="tab-project-packages" className="mt-8 grid min-w-0 gap-8 xl:grid-cols-[1fr_1.3fr]">
        <section aria-label="Project package list" className="min-w-0 space-y-6">
          <div className="min-w-0 border-t-2 border-ink bg-white p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-xl font-bold">Project Packages ({filteredProjects.length})</h2>
              <select value={projectCategory} onChange={(e) => { setProjectCategory(e.target.value); setProjectPage(1) }} className={inputClass} aria-label="Project category">
                <option value="All">All categories</option>
                {projectCategories.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </div>
            <input value={projectQuery} onChange={(e) => { setProjectQuery(e.target.value); setProjectPage(1) }} placeholder="Search by name, SKU, or id" aria-label="Search project packages" className={`mt-3 w-full ${inputClass}`} />
            <div className="mt-3 divide-y divide-line">
              {shownProjects.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <span className="block line-clamp-2 text-sm"><strong>{item.name}</strong> <span className="text-slate-400">{item.sku}</span></span>
                    <span className="text-[10px] font-black uppercase tracking-wide text-gold">{item.inventoryType || 'Catalog'} · {item.priceLabel}</span>
                  </div>
                  <span className="flex shrink-0 gap-2">
                    <button onClick={() => { setProduct(item); focusEditor('project-package-editor') }} className="text-xs font-bold text-navy underline">Edit</button>
                    <button onClick={() => setPreviewProduct(item)} className="text-xs font-bold text-slate-500 underline">Preview</button>
                    <button onClick={() => void toggleProductVisibility(item)} className="text-xs font-bold text-ink underline">{item.active === false ? 'Show' : 'Hide'}</button>
                    <button onClick={() => removeProduct(item.id)} className="text-xs font-bold text-red-600 underline">Delete</button>
                  </span>
                </div>
              ))}
              {shownProjects.length === 0 && <p className="py-3 text-sm text-slate-500">No project packages match &ldquo;{projectQuery}&rdquo;.</p>}
            </div>
            <Pager page={projectPage} totalPages={totalPages} onPage={setProjectPage} />
          </div>
        </section>
        <section id="project-package-editor" aria-label="Project package editor" className="min-w-0">
          <ProjectEditor product={product} onChange={setProduct} onSave={saveProduct} onReset={() => setProduct({ ...emptyProduct, productType: 'Project package', category: 'Project Packages' })} busy={busy} />
        </section>
      </div>
      {previewProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-5" role="dialog" aria-modal="true" aria-label="Project package preview" onClick={() => setPreviewProduct(null)}>
          <article className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-2xl border border-line bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="h-48 overflow-hidden rounded-t-2xl bg-ink">
              {previewProduct.image ? <Image src={previewProduct.image} alt={previewProduct.name} fill className="object-cover" /> : null}
            </div>
            <div className="flex flex-1 flex-col p-5">
              <p className="truncate text-xs font-black uppercase tracking-widest text-navy">Project Package</p>
              <h2 className="mt-2 line-clamp-2 font-display text-xl font-bold leading-snug text-ink">{previewProduct.name}</h2>
              <p className="mt-2 line-clamp-2 flex-1 text-sm leading-6 text-muted">{previewProduct.note || previewProduct.description}</p>
              <div className="mt-5 flex items-center justify-between gap-3">
                <strong className="font-display text-lg text-ink">{previewProduct.priceLabel}</strong>
                <button onClick={() => setPreviewProduct(null)} className="rounded-full bg-navy px-4 py-2 text-xs font-black text-white">View details</button>
              </div>
            </div>
          </article>
        </div>
      )}
    </>
  )
}
