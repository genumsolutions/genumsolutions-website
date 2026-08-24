export type CartLine = { productId: string; quantity: number }
export type CustomerMessage = { id: string; name: string; email: string; message: string; createdAt: string; status: 'new' | 'replied' }
export type Customer = {
  id: string
  name: string
  email: string
  phone?: string
  address?: string
  role?: 'customer' | 'admin'
  cart: CartLine[]
  messages: CustomerMessage[]
}
export type OrderItem = { productId: string; name: string; price: number; quantity: number }
export type Order = {
  id: string
  items: OrderItem[]
  totalNpr: number
  status: 'pending' | 'paid' | 'fulfilled' | 'cancelled'
  provider: 'stripe' | 'esewa' | 'khalti' | 'cod'
  customerName: string
  email: string
  phone: string
  address: string
  createdAt: string
}
