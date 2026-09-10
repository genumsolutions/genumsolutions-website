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

  // All countable metrics use `head: true` count queries — Postgres returns
  // only the number, never rows, so the dashboard cost is O(1) payload
  // regardless of how large the tables grow. Row selects are kept ONLY for
  // values that need arithmetic over rows (revenue sums, cart-line JSON).
  const [
    profilesResult,
    newUsersResult,
    ordersTotalResult,
    ordersPendingResult,
    ordersPaidResult,
    ordersFulfilledResult,
    ordersCancelledResult,
    paidOrdersRowsResult,
    productsTotalResult,
    productsLowStockResult,
    messagesTotalResult,
    messagesUnreadResult,
    transactionsTotalResult,
    transactionsSucceededResult,
    cartsResult,
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', todayISO),
    supabase.from('orders').select('*', { count: 'exact', head: true }),
    supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'paid'),
    supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'fulfilled'),
    supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'cancelled'),
    // Revenue needs the actual amounts: one narrow column pair, paid only.
    supabase.from('orders').select('total_npr, created_at').in('status', ['paid', 'fulfilled']),
    supabase.from('products').select('*', { count: 'exact', head: true }),
    supabase.from('products').select('*', { count: 'exact', head: true }).gt('stock', 0).lte('stock', 3),
    supabase.from('customer_messages').select('*', { count: 'exact', head: true }),
    supabase.from('customer_messages').select('*', { count: 'exact', head: true }).eq('status', 'new'),
    supabase.from('transactions').select('*', { count: 'exact', head: true }),
    supabase.from('transactions').select('*', { count: 'exact', head: true }).eq('status', 'succeeded'),
    // Cart contents are JSON lines; quantities must be summed in JS.
    supabase.from('carts').select('lines'),
  ])

  const profilesCount = profilesResult.count ?? 0
  const newUsersToday = newUsersResult.count ?? 0
  const paidOrders = (paidOrdersRowsResult.data ?? []) as { total_npr: number; created_at: string }[]
  const cartsAll = (cartsResult.data ?? []) as { lines: unknown }[]
  const cartItemCounts = cartsAll.map((cart) => Array.isArray(cart.lines) ? cart.lines.reduce((sum, line) => sum + (Number((line as { quantity?: number }).quantity) || 0), 0) : 0)

  const revenue = paidOrders.reduce((sum, o) => sum + (o.total_npr ?? 0), 0)
  const revenueToday = paidOrders.filter((o) => o.created_at >= todayISO).reduce((sum, o) => sum + (o.total_npr ?? 0), 0)

  return {
    totalUsers: profilesCount,
    totalCartItems: cartItemCounts.reduce((sum, count) => sum + count, 0),
    activeCarts: cartItemCounts.filter((count) => count > 0).length,
    newUsersToday,
    totalOrders: ordersTotalResult.count ?? 0,
    pendingOrders: ordersPendingResult.count ?? 0,
    paidOrders: ordersPaidResult.count ?? 0,
    fulfilledOrders: ordersFulfilledResult.count ?? 0,
    cancelledOrders: ordersCancelledResult.count ?? 0,
    revenue,
    revenueToday,
    totalProducts: productsTotalResult.count ?? 0,
    lowStockProducts: productsLowStockResult.count ?? 0,
    totalMessages: messagesTotalResult.count ?? 0,
    unreadMessages: messagesUnreadResult.count ?? 0,
    totalTransactions: transactionsTotalResult.count ?? 0,
    succeededTransactions: transactionsSucceededResult.count ?? 0,
  }
}
