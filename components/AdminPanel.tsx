'use client'

import { useEffect, useState } from 'react'
import { Activity, BookOpen, FileText, LayoutDashboard, MessageSquare, Package, Settings as SettingsIcon, ShoppingBag, Users, Wallet, Wrench } from 'lucide-react'
import { tabActive, tabBase, tabInactive } from '../lib/styles'
import { isAdminRole } from '../lib/roles'
import type { Product } from '../lib/content-store'
import { TABS } from './admin/admin-types'
import type { Tab } from './admin/admin-types'
import AdminDashboard from './admin/AdminDashboard'
import AdminOrders from './admin/AdminOrders'
import AdminProducts from './admin/AdminProducts'
import AdminServices from './admin/AdminServices'
import AdminJournal from './admin/AdminJournal'
import AdminMessages from './admin/AdminMessages'
import AdminFinance from './admin/AdminFinance'
import AdminUsers from './admin/AdminUsers'
import AdminActivity from './admin/AdminActivity'
import AdminProjectPackages from './admin/AdminProjectPackages'
import AdminContent from './admin/AdminContent'
import AdminSettings from './admin/AdminSettings'

type Props = { initialProducts: Product[]; currentRole: 'staff' | 'admin' | 'owner' }

const TAB_ICONS = {
  Dashboard: LayoutDashboard,
  Products: Package,
  Services: Wrench,
  Journal: BookOpen,
  Orders: ShoppingBag,
  Finance: Wallet,
  Users: Users,
  Messages: MessageSquare,
  Activity: Activity,
  Projects: Package,
  Content: FileText,
  Settings: SettingsIcon,
} as const

export default function AdminPanel({ initialProducts, currentRole }: Props) {
  const [tab, setTab] = useState<Tab>('Dashboard')
  const [products, setProducts] = useState(initialProducts)
  const [message, setMessage] = useState('')
  const [visited, setVisited] = useState<Set<number>>(() => new Set([0]))

  // Staff can run every panel but not perform deletions; owner additionally
  // gets the Users-hosted account deletion controls.
  const canDelete = isAdminRole(currentRole)

  const tabIndex = TABS.indexOf(tab)

  // Lazy-mount panels: keep the active panel and its immediate neighbours
  // mounted so left/right swiping always lands on already-rendered content,
  // without firing every panel's fetch on first load.
  useEffect(() => {
    setVisited((prev) => {
      const next = new Set(prev)
      next.add(tabIndex)
      if (tabIndex > 0) next.add(tabIndex - 1)
      if (tabIndex < TABS.length - 1) next.add(tabIndex + 1)
      return next
    })
  }, [tabIndex])

  function renderPanel(t: Tab) {
    switch (t) {
      case 'Dashboard': return <AdminDashboard />
      case 'Orders': return <AdminOrders canDelete={canDelete} />
      case 'Products': return <AdminProducts products={products} onProductsChange={setProducts} setMessage={setMessage} canDelete={canDelete} />
      case 'Services': return <AdminServices setMessage={setMessage} canDelete={canDelete} />
      case 'Journal': return <AdminJournal setMessage={setMessage} canDelete={canDelete} />
      case 'Messages': return <AdminMessages setMessage={setMessage} canDelete={canDelete} />
      case 'Finance': return <AdminFinance />
      case 'Users': return <AdminUsers setMessage={setMessage} canDelete={canDelete} currentRole={currentRole} />
      case 'Activity': return <AdminActivity />
      case 'Projects': return <AdminProjectPackages products={products} onProductsChange={setProducts} setMessage={setMessage} canDelete={canDelete} />
      case 'Content': return <AdminContent setMessage={setMessage} canDelete={canDelete} />
      case 'Settings': return <AdminSettings setMessage={setMessage} canDelete={canDelete} />
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
      <div role="tablist" aria-label="Admin sections" className="-mx-5 flex flex-wrap items-center gap-x-6 gap-y-1 border-b border-line px-5 pb-1 lg:mx-0 lg:px-0">
        {TABS.map((name, i) => {
          const Icon = TAB_ICONS[name]
          return (
            <button
              key={name}
              role="tab"
              id={`tab-${name.toLowerCase()}`}
              aria-selected={tab === name}
              aria-controls={`panel-${name.toLowerCase()}`}
              onClick={() => { setTab(name); setVisited((prev) => new Set(prev).add(i)) }}
              className={`${tabBase} text-[13px] ${tab === name ? tabActive : tabInactive}`}
            >
              <Icon size={15} aria-hidden="true" />
              {name}
            </button>
          )
        })}
      </div>

      {message && <p role="status" className="mt-4 border-l-4 border-navy bg-white px-4 py-3 text-sm font-bold text-ink">{message}</p>}

      {/* Swipeable track: panels translate horizontally in sync with the tab strip */}
      <div className="overflow-hidden">
        <div
          className="flex transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${tabIndex * 100}%)` }}
        >
          {TABS.map((name, i) => (
            <div
              key={name}
              role="tabpanel"
              id={`panel-${name.toLowerCase()}`}
              aria-labelledby={`tab-${name.toLowerCase()}`}
              className="w-full shrink-0"
            >
              {visited.has(i) ? renderPanel(name) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
