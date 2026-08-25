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

  const [totalResult, todayResult, pathsResult, dailyResult] = await Promise.all([
    supabase.from('page_views').select('*', { count: 'exact', head: true }).gte('created_at', since),
    supabase.from('page_views').select('*', { count: 'exact', head: true }).gte('created_at', todayStart.toISOString()),
    supabase.from('page_views').select('path').gte('created_at', since),
    supabase.from('page_views').select('created_at').gte('created_at', since).order('created_at', { ascending: true }),
  ])

  const totalViews = totalResult.count ?? 0
  const todayViews = todayResult.count ?? 0

  // Aggregate top paths
  const allPaths = (pathsResult.data ?? []) as { path: string }[]
  const pathMap = new Map<string, { count: number; users: Set<string> }>()
  allPaths.forEach(({ path }) => {
    const entry = pathMap.get(path) ?? { count: 0, users: new Set() }
    entry.count++
    pathMap.set(path, entry)
  })
  const topPaths = Array.from(pathMap.entries())
    .map(([path, { count, users }]) => ({ path, count, uniqueUsers: users.size }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20)

  // Aggregate by day
  const dailyRows = (dailyResult.data ?? []) as { created_at: string }[]
  const dayMap = new Map<string, number>()
  dailyRows.forEach(({ created_at }) => {
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
  newUsersToday: number
  totalOrders: number
  pendingOrders: number
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

  const [
    totalUsersResult,
    newUsersResult,
    totalOrdersResult,
    pendingOrdersResult,
    revenueResult,
    revenueTodayResult,
    productsResult,
    lowStockResult,
    messagesResult,
    unreadResult,
    transactionsResult,
    succeededResult,
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', todayISO),
    supabase.from('orders').select('*', { count: 'exact', head: true }),
    supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('orders').select('total_npr').in('status', ['paid', 'fulfilled']),
    supabase.from('orders').select('total_npr').in('status', ['paid', 'fulfilled']).gte('created_at', todayISO),
    supabase.from('products').select('*', { count: 'exact', head: true }),
    supabase.from('products').select('*', { count: 'exact', head: true }).lte('stock', 3).gt('stock', 0),
    supabase.from('customer_messages').select('*', { count: 'exact', head: true }),
    supabase.from('customer_messages').select('*', { count: 'exact', head: true }).eq('status', 'new'),
    supabase.from('transactions').select('*', { count: 'exact', head: true }),
    supabase.from('transactions').select('*', { count: 'exact', head: true }).eq('status', 'succeeded'),
  ])

  const revenueRows = (revenueResult.data ?? []) as { total_npr: number }[]
  const revenueTodayRows = (revenueTodayResult.data ?? []) as { total_npr: number }[]

  return {
    totalUsers: totalUsersResult.count ?? 0,
    newUsersToday: newUsersResult.count ?? 0,
    totalOrders: totalOrdersResult.count ?? 0,
    pendingOrders: pendingOrdersResult.count ?? 0,
    revenue: revenueRows.reduce((sum, r) => sum + (r.total_npr ?? 0), 0),
    revenueToday: revenueTodayRows.reduce((sum, r) => sum + (r.total_npr ?? 0), 0),
    totalProducts: productsResult.count ?? 0,
    lowStockProducts: lowStockResult.count ?? 0,
    totalMessages: messagesResult.count ?? 0,
    unreadMessages: unreadResult.count ?? 0,
    totalTransactions: transactionsResult.count ?? 0,
    succeededTransactions: succeededResult.count ?? 0,
  }
}
