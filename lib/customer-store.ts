import { createClient, createServiceClient, getSessionUser, supabaseConfigured } from './supabase/server'
import type { CartLine, CustomerMessage, Customer } from './customer'

// Pure helper kept from the previous implementation: additive cart merge keyed by productId.
export function mergeCart(current: CartLine[], incoming: CartLine[]) {
  const merged = new Map(current.map((line) => [line.productId, line.quantity]))
  incoming.forEach((line) => merged.set(line.productId, (merged.get(line.productId) || 0) + Math.max(0, Math.floor(line.quantity))))
  return Array.from(merged, ([productId, quantity]) => ({ productId, quantity })).filter((line) => line.quantity > 0)
}

export async function getProfile(userId: string): Promise<Customer | null> {
  if (!supabaseConfigured()) return null
  const db = createClient()
  const [{ data: profile }, { data: cart }, { data: messages }] = await Promise.all([
    db.from('profiles').select('id, name, phone, address, role').eq('id', userId).maybeSingle(),
    db.from('carts').select('lines').eq('user_id', userId).maybeSingle(),
    db.from('customer_messages').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
  ])
  if (!profile) return null
  return {
    id: profile.id,
    name: profile.name || '',
    email: '',
    phone: profile.phone || '',
    address: profile.address || '',
    role: (profile.role as Customer['role']) || 'customer',
    cart: Array.isArray(cart?.lines) ? (cart!.lines as CartLine[]) : [],
    messages: (messages || []).map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      message: row.message,
      createdAt: row.created_at,
      status: row.status,
    })) as CustomerMessage[],
  }
}

export async function updateProfile(userId: string, patch: Partial<Pick<Customer, 'name' | 'phone' | 'address'>>) {
  const update: Record<string, string> = {}
  if (typeof patch.name === 'string') update.name = patch.name.trim().slice(0, 120)
  if (typeof patch.phone === 'string') update.phone = patch.phone.trim().slice(0, 40)
  if (typeof patch.address === 'string') update.address = patch.address.trim().slice(0, 500)
  if (!Object.keys(update).length) return null
  const { data, error } = await createClient().from('profiles').update(update).eq('id', userId).select().single()
  if (error || !data) return null
  return data
}

export async function getCart(userId: string): Promise<CartLine[]> {
  const { data } = await createClient().from('carts').select('lines').eq('user_id', userId).maybeSingle()
  return Array.isArray(data?.lines) ? (data!.lines as CartLine[]) : []
}

export async function saveCart(userId: string, lines: CartLine[]): Promise<CartLine[]> {
  await createClient().from('carts').upsert({ user_id: userId, lines, updated_at: new Date().toISOString() })
  return lines
}

export async function addCustomerMessage(userId: string | null, message: Pick<CustomerMessage, 'name' | 'email' | 'message'>) {
  await createClient().from('customer_messages').insert({
    ...(userId ? { user_id: userId } : {}),
    name: message.name,
    email: message.email,
    message: message.message,
  })
}

export async function getMessages(userId: string): Promise<CustomerMessage[]> {
  const { data } = await createClient().from('customer_messages').select('*').eq('user_id', userId).order('created_at', { ascending: false })
  return (data || []).map((row) => ({ id: row.id, name: row.name, email: row.email, message: row.message, createdAt: row.created_at, status: row.status }))
}

// Convenience for route handlers: session user + full customer view in one call.
export async function getCurrentCustomer(): Promise<Customer | null> {
  const user = await getSessionUser()
  if (!user) return null
  let profile = await getProfile(user.id)
  if (!profile) {
    // Self-heal: users created before the profiles trigger existed would otherwise
    // look logged out forever, since RLS blocks them from inserting their own row.
    try {
      await createServiceClient().from('profiles').upsert({ id: user.id, name: user.email.split('@')[0] })
      profile = await getProfile(user.id)
    } catch {
      // Service-role key unavailable or upsert failed - stay logged out gracefully.
    }
  }
  if (!profile) return null
  return { ...profile, email: user.email }
}
