'use client'

import { useEffect, useState } from 'react'
import { formatNPR } from '../../lib/catalog'
import { inputClass } from '../../lib/styles'
import type { OrderPage } from './admin-types'
import { STATUSES, PAGE_SIZE } from './admin-types'
import { Pager, formatTimestamp } from './admin-helpers'

// Detail fields shown in the expandable row (app-parity: the app's Orders tab
// shows the full items list + address + provider + timestamps on the card).
type OrderRow = OrderPage['orders'][number]

export default function AdminOrders() {
  const [orderData, setOrderData] = useState<OrderPage>({ orders: [], total: 0, page: 1, totalPages: 1 })
  const [loaded, setLoaded] = useState(false)
  const [orderQuery, setOrderQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void loadOrders(1) }, [])

  async function loadOrders(page: number) {
    setLoaded(false)
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
      if (orderQuery.trim()) params.set('q', orderQuery.trim())
      if (statusFilter) params.set('status', statusFilter)
      const response = await fetch(`/api/admin/orders?${params}`)
      if (response.ok) setOrderData(await response.json())
    } finally { setLoaded(true) }
  }

  async function setOrderStatus(id: string, status: string) {
    const response = await fetch('/api/admin/orders', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) })
    if (response.ok) setOrderData((current) => ({ ...current, orders: current.orders.map((order) => order.id === id ? { ...order, status } : order) }))
  }

  async function deleteOrder(id: string) {
    if (!window.confirm(`Delete order #${id.slice(0, 8).toUpperCase()}? This also removes its finance transactions.`)) return
    const response = await fetch(`/api/admin/orders?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    if (response.ok) {
      setOrderData((current) => ({ ...current, orders: current.orders.filter((order) => order.id !== id), total: Math.max(0, current.total - 1) }))
    } else {
      const result = await response.json().catch(() => ({}))
      window.alert(result.error || 'Could not delete the order.')
    }
  }

  return (
    <section role="tabpanel" id="panel-orders" aria-labelledby="tab-orders" aria-label="Customer orders" className="mt-8 space-y-4">
      <div className="flex flex-col gap-3 border-t-2 border-ink bg-white p-6 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <h2 className="font-display text-xl font-bold">Customer orders</h2>
        <label className="ml-auto text-sm font-bold text-slate-500">Search buyer
          <input value={orderQuery} onChange={(e) => setOrderQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void loadOrders(1)} placeholder="email or name" aria-label="Search orders" className={`mt-1 w-full sm:ml-2 sm:mt-0 sm:w-48 ${inputClass}`} />
        </label>
        <label className="text-sm font-bold text-slate-500">Status
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter by status" className="ml-2 border border-line px-3 py-2 text-sm font-bold">
            <option value="">All</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <button onClick={() => void loadOrders(1)} className="bg-navy px-4 py-2 text-xs font-black text-white transition hover:bg-navy-dark">Apply</button>
      </div>
      {!loaded ? <p className="text-sm text-slate-500" role="status">Loading…</p> : orderData.orders.length === 0 ? <p className="text-sm text-slate-500">No orders found.</p> : (
        <>
          <ul className="space-y-3">
            {orderData.orders.map((order) => (
              <li key={order.id} className="border border-line bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-black">#{order.id.slice(0, 8).toUpperCase()} · {formatNPR(order.totalNpr)}</p>
                    <p className="break-words text-xs text-slate-500">{order.customerName} · {order.email}</p>
                    <p className="break-words text-xs text-slate-400">{order.address}</p>
                    <p className="text-xs text-slate-400">{order.provider} · {formatTimestamp(order.createdAt)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <select value={order.status} onChange={(e) => setOrderStatus(order.id, e.target.value)} aria-label={`Status for ${order.id.slice(0, 8)}`} className="border border-line px-2 py-1 text-xs font-bold">{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select>
                    <button onClick={() => setExpandedId((current) => current === order.id ? null : order.id)} aria-expanded={expandedId === order.id} className="border border-line px-2 py-1 text-xs font-bold text-navy transition hover:border-navy">
                      {expandedId === order.id ? 'Hide' : 'Details'}
                    </button>
                    <button onClick={() => deleteOrder(order.id)} className="border border-red-200 px-2 py-1 text-xs font-bold text-red-600 transition hover:bg-red-50">Delete</button>
                  </div>
                </div>
                <ul className="mt-2 space-y-1 text-xs leading-5 text-slate-600">{order.items.map((item) => <li key={`${order.id}-${item.name}`} className="truncate">{item.quantity} × {item.name} ({formatNPR(item.price * item.quantity)})</li>)}</ul>
                {expandedId === order.id && (
                  <dl className="mt-3 grid grid-cols-[7rem_1fr] gap-x-3 gap-y-1 border-t border-line pt-3 text-xs leading-5">
                    <dt className="font-bold uppercase tracking-wide text-slate-500">Order id</dt>
                    <dd className="break-all text-slate-700">{order.id}</dd>
                    <dt className="font-bold uppercase tracking-wide text-slate-500">Buyer</dt>
                    <dd className="text-slate-700">{order.customerName} · {order.email}</dd>
                    <dt className="font-bold uppercase tracking-wide text-slate-500">Phone</dt>
                    <dd className="text-slate-700">{(order as OrderRow & { phone?: string }).phone || '—'}</dd>
                    <dt className="font-bold uppercase tracking-wide text-slate-500">Address</dt>
                    <dd className="break-words text-slate-700">{order.address || '—'}</dd>
                    <dt className="font-bold uppercase tracking-wide text-slate-500">Provider</dt>
                    <dd className="text-slate-700">{order.provider}{(order as OrderRow & { providerRef?: string }).providerRef ? ` · ref ${(order as OrderRow & { providerRef?: string }).providerRef}` : ''}</dd>
                    <dt className="font-bold uppercase tracking-wide text-slate-500">Placed</dt>
                    <dd className="text-slate-700">{formatTimestamp(order.createdAt)}</dd>
                    <dt className="font-bold uppercase tracking-wide text-slate-500">Items</dt>
                    <dd className="text-slate-700">
                      <ul className="space-y-0.5">{order.items.map((item) => <li key={`${order.id}-detail-${item.name}`}>{item.quantity} × {item.name} @ {formatNPR(item.price)}</li>)}</ul>
                    </dd>
                    <dt className="font-bold uppercase tracking-wide text-slate-500">Total</dt>
                    <dd className="font-black text-ink">{formatNPR(order.totalNpr)}</dd>
                  </dl>
                )}
              </li>
            ))}
          </ul>
          <Pager page={orderData.page} totalPages={orderData.totalPages} onPage={(page) => void loadOrders(page)} />
          <p className="text-xs text-slate-400">{orderData.total} total order{orderData.total === 1 ? '' : 's'}</p>
        </>
      )}
    </section>
  )
}
