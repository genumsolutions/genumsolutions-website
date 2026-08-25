'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { clearLocalCart, readLocalCart, unionQuantities, writeLocalCart } from '../lib/cart-client'
import type { CartLine } from '../lib/customer'

type CartContextValue = {
  lines: CartLine[]
  count: number
  hydrated: boolean
  authenticated: boolean | null
  add: (productId: string, quantity?: number) => void
  setQuantity: (productId: string, quantity: number) => void
  remove: (productId: string) => void
  clear: () => void
}

const CartContext = createContext<CartContextValue | null>(null)

// One source of truth for the cart across header badge, catalog, product page,
// and checkout. Guests persist to localStorage; signed-in users also sync a
// REPLACE payload to /api/cart. `hydrated` gates rendering so the cart never
// flashes empty while the initial state loads.
export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([])
  const [hydrated, setHydrated] = useState(false)
  const [authenticated, setAuthenticated] = useState<boolean | null>(null)
  const linesRef = useRef<CartLine[]>([])

  const commit = useCallback((next: CartLine[]) => {
    linesRef.current = next
    setLines(next)
    writeLocalCart(next)
  }, [])

  useEffect(() => {
    // Adopt localStorage immediately so the UI is never briefly empty.
    const local = readLocalCart()
    linesRef.current = local
    setLines(local)
    let cancelled = false

    async function reconcile() {
      try {
        const response = await fetch('/api/cart')
        const data = await response.json()
        if (cancelled) return
        setAuthenticated(Boolean(data.authenticated))
        if (!data.authenticated) return
        const serverCart: CartLine[] = Array.isArray(data.cart) ? data.cart : []
        // Signed in: fold any local-only additions into the server cart once,
        // then treat the server response as truth.
        const merged = unionQuantities(serverCart, local)
        if (merged.length !== serverCart.length || JSON.stringify(merged) !== JSON.stringify(serverCart)) {
          const saved = await fetch('/api/cart', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cart: merged }),
          }).then((res) => res.json())
          if (!cancelled && Array.isArray(saved.cart)) {
            linesRef.current = saved.cart
            setLines(saved.cart)
            writeLocalCart(saved.cart)
            return
          }
        }
        if (!cancelled && serverCart.length) {
          linesRef.current = serverCart
          setLines(serverCart)
          writeLocalCart(serverCart)
        }
      } catch {
        // Offline or API hiccup - keep whatever localStorage had.
      } finally {
        if (!cancelled) setHydrated(true)
      }
    }
    void reconcile()
    return () => { cancelled = true }
  }, [])

  const persist = useCallback((next: CartLine[]) => {
    commit(next)
    if (linesRef.current.length === 0) {
      void fetch('/api/cart', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cart: [] }) }).catch(() => undefined)
      return
    }
    if (authenticated === false) return
    void fetch('/api/cart', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cart: next }),
    }).catch(() => undefined)
  }, [authenticated, commit])

  const add = useCallback((productId: string, quantity = 1) => {
    const current = linesRef.current
    const existing = current.find((line) => line.productId === productId)
    const next = existing
      ? current.map((line) => line.productId === productId ? { ...line, quantity: Math.min(99, line.quantity + Math.max(1, quantity)) } : line)
      : [...current, { productId, quantity: Math.max(1, Math.min(99, quantity)) }]
    persist(next)
  }, [persist])

  const setQuantity = useCallback((productId: string, quantity: number) => {
    const safe = Math.floor(quantity)
    if (!Number.isFinite(safe)) return
    const next = safe <= 0
      ? linesRef.current.filter((line) => line.productId !== productId)
      : linesRef.current.map((line) => line.productId === productId ? { ...line, quantity: Math.min(99, safe) } : line)
    persist(next)
  }, [persist])

  const remove = useCallback((productId: string) => {
    persist(linesRef.current.filter((line) => line.productId !== productId))
  }, [persist])

  const clear = useCallback(() => {
    commit([])
    clearLocalCart()
    void fetch('/api/cart', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cart: [] }) }).catch(() => undefined)
  }, [commit])

  const value = useMemo<CartContextValue>(() => ({
    lines,
    count: lines.reduce((sum, line) => sum + line.quantity, 0),
    hydrated,
    authenticated,
    add,
    setQuantity,
    remove,
    clear,
  }), [lines, hydrated, authenticated, add, setQuantity, remove, clear])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext)
  if (!context) throw new Error('useCart must be used inside <CartProvider>')
  return context
}
