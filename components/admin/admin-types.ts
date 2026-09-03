import type { Product } from '../../lib/content-store'

export type { Product }

export const PAGE_SIZE = 10

export const STATUSES = ['pending', 'paid', 'fulfilled', 'cancelled'] as const

export const TABS = ['Orders', 'Products', 'Messages', 'Services', 'Finance', 'Users', 'Dashboard', 'Activity', 'ProjectPackages'] as const
export type Tab = typeof TABS[number]

export type Order = {
  id: string
  items: { name: string; quantity: number; price: number }[]
  totalNpr: number
  status: string
  provider: string
  customerName: string
  email: string
  address: string
  createdAt: string
}

export type OrderPage = { orders: Order[]; total: number; page: number; totalPages: number }

export type ManagedUser = {
  id: string
  email: string
  name: string
  phone: string
  address: string
  role: string
  createdAt: string
  lastSignInAt: string | null
}

export type UserPage = { users: ManagedUser[]; page: number; hasMore: boolean }

export type DashboardStats = {
  totalUsers: number
  newUsersToday: number
  totalCartItems: number
  activeCarts: number
  totalOrders: number
  pendingOrders: number
  paidOrders: number
  fulfilledOrders: number
  cancelledOrders: number
  revenue: number
  revenueToday: number
  totalProducts: number
  lowStockProducts: number
  totalMessages: number
  unreadMessages: number
  totalTransactions: number
  succeededTransactions: number
}

export type Service = {
  id: string
  name: string
  category: string
  priceLabel: string
  description: string
  tag: string
  sortOrder: number
  active: boolean
}

export type ActivityEntry = {
  id: string
  userId: string | null
  action: string
  entityType: string
  entityId: string | null
  details: Record<string, unknown>
  createdAt: string
}

export type Message = {
  id: string
  name: string
  email: string
  message: string
  status: string
  created_at: string
}

export type PageViewStat = { path: string; count: number; uniqueUsers: number }

export type Analytics = {
  totalViews: number
  todayViews: number
  topPaths: PageViewStat[]
  viewsByDay: { date: string; count: number }[]
}

export const emptyProduct: Product = {
  id: '', name: '', category: 'Controllers & Boards', price: 0, priceLabel: 'Request quote',
  sku: '', productType: 'Retail kit', note: '', description: '', specs: [],
  audience: 'Students, schools, hobbyists, and makers', difficulty: 'Beginner',
  warranty: '7-day component replacement for manufacturing defects', stock: 0,
  delivery: 'Ships in 1-2 working days', color: 'from-[#dce8ff] to-[#7e9ff2]', image: '',
}

export const emptyService: Service = {
  id: '', name: '', category: 'General', priceLabel: 'Request quote',
  description: '', tag: '', sortOrder: 1000, active: true,
}

export const fields = ['id', 'name', 'category', 'sku', 'price', 'priceLabel', 'stock', 'note', 'description'] as const
