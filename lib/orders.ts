import { createClient, getSessionUser } from './supabase/server'
import { saveCart } from './customer-store'
import type { Order, OrderItem } from './customer'

type OrderRow = {
  id: string
  items: unknown
  total_npr: number
  status: Order['status']
  provider: Order['provider']
  customer_name: string
  email: string
  phone: string
  address: string
  provider_ref: string | null
  created_at: string
}

function rowToOrder(row: OrderRow): Order {
  return {
    id: row.id,
    items: Array.isArray(row.items) ? (row.items as OrderItem[]) : [],
    totalNpr: row.total_npr,
    status: row.status,
    provider: row.provider,
    customerName: row.customer_name,
    email: row.email,
    phone: row.phone,
    address: row.address,
    createdAt: row.created_at,
  }
}

export async function getCurrentUserOrThrow() {
  const user = await getSessionUser()
  if (!user) return null
  return user
}

export async function listOrders(userId?: string): Promise<Order[]> {
  const query = createClient()
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)
  const { data, error } = await (userId ? query.eq('user_id', userId) : query)
  if (error || !data) return []
  return data.map(rowToOrder)
}

export async function createOrder(input: {
  userId: string
  items: OrderItem[]
  totalNpr: number
  provider: Order['provider']
  customerName: string
  email: string
  phone: string
  address: string
}): Promise<Order | null> {
  const { data, error } = await createClient()
    .from('orders')
    .insert({
      user_id: input.userId,
      items: input.items,
      total_npr: input.totalNpr,
      provider: input.provider,
      status: 'pending',
      customer_name: input.customerName,
      email: input.email,
      phone: input.phone,
      address: input.address,
    })
    .select()
    .single()
  if (error || !data) return null
  return rowToOrder(data)
}

export async function setOrderRef(orderId: string, providerRef: string) {
  await createClient().from('orders').update({ provider_ref: providerRef, updated_at: new Date().toISOString() }).eq('id', orderId)
}

export async function findOrderByRef(providerRef: string): Promise<Order & { userId: string } | null> {
  const { data } = await createClient().from('orders').select('*').eq('provider_ref', providerRef).maybeSingle()
  if (!data) return null
  return { ...rowToOrder(data), userId: data.user_id }
}

export async function findOrderById(orderId: string): Promise<Order & { userId: string } | null> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId)) return null
  const { data } = await createClient().from('orders').select('*').eq('id', orderId).maybeSingle()
  if (!data) return null
  return { ...rowToOrder(data), userId: data.user_id }
}

export async function updateOrderStatus(orderId: string, status: Order['status']) {
  await createClient().from('orders').update({ status, updated_at: new Date().toISOString() }).eq('id', orderId)
}

// Marks an order paid and empties the buyer's saved cart.
export async function markOrderPaidAndClearCart(order: Order & { userId: string }) {
  if (order.status === 'pending') await updateOrderStatus(order.id, 'paid')
  await saveCart(order.userId, [])
}
