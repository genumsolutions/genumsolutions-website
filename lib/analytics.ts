import { createServiceClient } from './supabase/server'

export type PageViewEntry = {
  path: string
  count: number
  uniqueUsers: number
}

export async function recordPageView(input: { path: string; userId?: string | null; referrer?: string }): Promise<void> {
  try {
    const supabase = createServiceClient()
    await supabase.from('page_views').insert({
      path: input.path,
      user_id: input.userId ?? null,
      referrer: input.referrer ?? null,
    })
  } catch {
    // Best-effort; never breaks the page.
  }
}

export async function getPageViewStats(options: { days?: number } = {}): Promise<{
  totalViews: number
  todayViews: number
  topPaths: PageViewEntry[]
  viewsByDay: { date: string; count: number }[]
}> {
  const days = options.days ?? 30
  const supabase = createServiceClient()
  const since = new Date(Date.now() - days * 86400000).toISOString()
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayISO = todayStart.toISOString()

  // Reduced from 4 to 2 queries: fetch all rows once, compute counts in JS
  const [allResult, todayResult] = await Promise.all([
    supabase.from('page_views').select('path, created_at, user_id').gte('created_at', since),
    supabase.from('page_views').select('*', { count: 'exact', head: true }).gte('created_at', todayISO),
  ])

  const todayViews = todayResult.count ?? 0
  const allRows = (allResult.data ?? []) as { path: string; created_at: string; user_id: string | null }[]
  const totalViews = allRows.length

  // Aggregate top paths
  const pathMap = new Map<string, { count: number; users: Set<string> }>()
  allRows.forEach(({ path, user_id }) => {
    const entry = pathMap.get(path) ?? { count: 0, users: new Set() }
    entry.count++
    if (user_id) entry.users.add(user_id)
    pathMap.set(path, entry)
  })
  const topPaths = Array.from(pathMap.entries())
    .map(([path, { count, users }]) => ({ path, count, uniqueUsers: users.size }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20)

  // Aggregate by day
  const dayMap = new Map<string, number>()
  allRows.forEach(({ created_at }) => {
    const day = created_at.slice(0, 10)
    dayMap.set(day, (dayMap.get(day) ?? 0) + 1)
  })
  const viewsByDay = Array.from(dayMap.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date))

  return { totalViews, todayViews, topPaths, viewsByDay }
}

export async function getDashboardStats(): Promise<{
  totalUsers: number
  totalCartItems: number
  activeCarts: number
  newUsersToday: number
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
}> {
  const supabase = createServiceClient()
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayISO = todayStart.toISOString()

  // Reduced from 12 to 6 parallel queries by pairing related counts
  const [
    profilesResult,
    newUsersResult,
    ordersAllResult,
    productsResult,
    messagesResult,
    transactionsResult,
    cartsResult,
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', todayISO),
    supabase.from('orders').select('total_npr, status, created_at'),
    supabase.from('products').select('stock'),
    supabase.from('customer_messages').select('status'),
    supabase.from('transactions').select('status'),
    supabase.from('carts').select('lines'),
  ])

  const profilesCount = profilesResult.count ?? 0
  const newUsersToday = newUsersResult.count ?? 0
  const ordersAll = (ordersAllResult.data ?? []) as { total_npr: number; status: string; created_at: string }[]
  const productsAll = (productsResult.data ?? []) as { stock: number }[]
  const messagesAll = (messagesResult.data ?? []) as { status: string }[]
  const transactionsAll = (transactionsResult.data ?? []) as { status: string }[]
  const cartsAll = (cartsResult.data ?? []) as { lines: unknown }[]
  const cartItemCounts = cartsAll.map((cart) => Array.isArray(cart.lines) ? cart.lines.reduce((sum, line) => sum + (Number((line as { quantity?: number }).quantity) || 0), 0) : 0)

  const totalOrders = ordersAll.length
  const pendingOrders = ordersAll.filter((o) => o.status === 'pending').length
  const paidOrdersCount = ordersAll.filter((o) => o.status === 'paid').length
  const fulfilledOrdersCount = ordersAll.filter((o) => o.status === 'fulfilled').length
  const cancelledOrdersCount = ordersAll.filter((o) => o.status === 'cancelled').length
  const paidOrders = ordersAll.filter((o) => o.status === 'paid' || o.status === 'fulfilled')
  const revenue = paidOrders.reduce((sum, o) => sum + (o.total_npr ?? 0), 0)
  const revenueToday = paidOrders.filter((o) => o.created_at >= todayISO).reduce((sum, o) => sum + (o.total_npr ?? 0), 0)

  return {
    totalUsers: profilesCount,
    totalCartItems: cartItemCounts.reduce((sum, count) => sum + count, 0),
    activeCarts: cartItemCounts.filter((count) => count > 0).length,
    newUsersToday,
    totalOrders,
    pendingOrders,
    paidOrders: paidOrdersCount,
    fulfilledOrders: fulfilledOrdersCount,
    cancelledOrders: cancelledOrdersCount,
    revenue,
    revenueToday,
    totalProducts: productsAll.length,
    lowStockProducts: productsAll.filter((p) => p.stock > 0 && p.stock <= 3).length,
    totalMessages: messagesAll.length,
    unreadMessages: messagesAll.filter((m) => m.status === 'new').length,
    totalTransactions: transactionsAll.length,
    succeededTransactions: transactionsAll.filter((t) => t.status === 'succeeded').length,
  }
}
