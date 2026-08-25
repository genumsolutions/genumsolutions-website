import type { CartLine } from './customer'

export const CART_KEY = 'genum-cart'
export const MAX_QUANTITY_PER_LINE = 99

// Safe reader: never throws, drops malformed lines, clamps to sane bounds.
export function readLocalCart(): CartLine[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = JSON.parse(window.localStorage.getItem(CART_KEY) || '[]')
    if (!Array.isArray(raw)) return []
    return raw
      .filter((line: unknown): line is CartLine =>
        Boolean(line && typeof line === 'object') &&
        typeof (line as CartLine).productId === 'string' &&
        Number.isFinite((line as CartLine).quantity))
      .map((line: CartLine) => ({
        productId: line.productId,
        quantity: Math.max(1, Math.min(MAX_QUANTITY_PER_LINE, Math.floor(line.quantity))),
      }))
      .filter((line: CartLine) => line.productId.length > 0)
  } catch {
    return []
  }
}

export function writeLocalCart(lines: CartLine[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(CART_KEY, JSON.stringify(lines))
}

export function clearLocalCart() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(CART_KEY)
}

// Additive union used ONLY at sign-in time so nothing from either side is lost.
export function unionQuantities(a: CartLine[], b: CartLine[]): CartLine[] {
  const merged = new Map<string, number>()
  ;[...a, ...b].forEach((line) => {
    merged.set(line.productId, (merged.get(line.productId) || 0) + line.quantity)
  })
  return Array.from(merged.entries())
    .map(([productId, quantity]) => ({ productId, quantity: Math.min(MAX_QUANTITY_PER_LINE, quantity) }))
    .filter((line) => line.quantity > 0)
}
