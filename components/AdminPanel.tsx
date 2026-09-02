'use client'

import { useState } from 'react'
import { Activity, LayoutDashboard, MessageSquare, Package, ShoppingBag, Users, Wallet, Wrench } from 'lucide-react'
import { tabActive, tabBase, tabInactive } from '../lib/styles'
import type { Product } from '../lib/content-store'
import { TABS } from './admin/admin-types'
import type { Tab } from './admin/admin-types'
import AdminDashboard from './admin/AdminDashboard'
import AdminOrders from './admin/AdminOrders'
import AdminProducts from './admin/AdminProducts'
import AdminServices from './admin/AdminServices'
import AdminMessages from './admin/AdminMessages'
import AdminFinance from './admin/AdminFinance'
import AdminUsers from './admin/AdminUsers'
import AdminActivity from './admin/AdminActivity'
import AdminProjectPackages from './admin/AdminProjectPackages'

type Props = { initialProducts: Product[] }

const TAB_ICONS = {
  Dashboard: LayoutDashboard,
  Products: Package,
  Services: Wrench,
  Orders: ShoppingBag,
  Finance: Wallet,
  Users: Users,
  Messages: MessageSquare,
  Activity: Activity,
  ProjectPackages: Package,
} as const

export default function AdminPanel({ initialProducts }: Props) {
  const [tab, setTab] = useState<Tab>('Orders')
  const [products, setProducts] = useState(initialProducts)
  const [message, setMessage] = useState('')

  return (
    <div className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
      <div role="tablist" aria-label="Admin sections" className="-mx-5 flex flex-wrap items-center gap-x-6 gap-y-1 border-b border-line px-5 pb-1 lg:mx-0 lg:px-0">
        {TABS.map((name) => {
          const Icon = TAB_ICONS[name]
          return (
            <button
              key={name}
              role="tab"
              id={`tab-${name.toLowerCase()}`}
              aria-selected={tab === name}
              aria-controls={`panel-${name.toLowerCase()}`}
              onClick={() => setTab(name)}
              className={`${tabBase} text-[13px] ${tab === name ? tabActive : tabInactive}`}
            >
              <Icon size={15} aria-hidden="true" />
              {name}
            </button>
          )
        })}
      </div>

      {message && <p role="status" className="mt-4 border-l-4 border-navy bg-white px-4 py-3 text-sm font-bold text-ink">{message}</p>}

      {tab === 'Dashboard' && <AdminDashboard />}
      {tab === 'Orders' && <AdminOrders />}
      {tab === 'Products' && <AdminProducts products={products} onProductsChange={setProducts} setMessage={setMessage} />}
      {tab === 'Services' && <AdminServices setMessage={setMessage} />}
      {tab === 'Messages' && <AdminMessages setMessage={setMessage} />}
      {tab === 'Finance' && <AdminFinance />}
      {tab === 'Users' && <AdminUsers setMessage={setMessage} />}
      {tab === 'Activity' && <AdminActivity />}
      {tab === 'ProjectPackages' && <AdminProjectPackages products={products} onProductsChange={setProducts} setMessage={setMessage} />}
    </div>
  )
}
