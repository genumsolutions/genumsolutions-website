'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { clearLocalCart, readLocalCart, writeLocalCart } from '../lib/cart-client'
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
// REPLACE payload to /api/cart (the DB-backed carts table is the source of
// truth). `hydrated` gates rendering so the cart never flashes empty while
// the initial state loads.
export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([])
  const [hydrated, setHydrated] = useState(false)
  const [authenticated, setAuthenticated] = useState<boolean | null>(null)
  const linesRef = useRef<CartLine[]>([])
  // Server writes are serialized through a promise queue so the LAST user
  // action always lands last on the DB even if requests race.
  const writeQueueRef = useRef<Promise<void>>(Promise.resolve())
  const pendingWritesRef = useRef(0)
  const lastSyncedAtRef = useRef(0)

  const commit = useCallback((next: CartLine[]) => {
    linesRef.current = next
    setLines(next)
    writeLocalCart(next)
  }, [])

  // Queue a REPLACE write to /api/cart. Pending writes are tracked so a
  // focus-triggered reconcile never overwrites an action that has not landed.
  const sendReplace = useCallback((next: CartLine[]) => {
    pendingWritesRef.current += 1
    writeQueueRef.current = writeQueueRef.current
      .then(async () => {
        await fetch('/api/cart', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cart: next }),
        }).catch(() => undefined)
      })
      .finally(() => {
        pendingWritesRef.current = Math.max(0, pendingWritesRef.current - 1)
        lastSyncedAtRef.current = Date.now()
      })
  }, [])

  const fetchServerCart = useCallback(async () => {
    try {
      const response = await fetch('/api/cart')
      const data = await response.json()
      return {
        authenticated: Boolean(data.authenticated),
        cart: Array.isArray(data.cart) ? (data.cart as CartLine[]) : [],
      }
    } catch {
      return null
    }
  }, [])

  useEffect(() => {
    // Adopt localStorage immediately so the UI is never briefly empty.
    const local = readLocalCart()
    linesRef.current = local
    setLines(local)
    let cancelled = false

    async function reconcile() {
      try {
        const data = await fetchServerCart()
        if (cancelled || !data) return
        setAuthenticated(data.authenticated)
        if (!data.authenticated) return
        const serverCart = data.cart
        // Signed in: the server cart is always the source of truth.
        // Only push local-only items the server doesn't already have (guest
        // additions made before the session cookie was ready).
        const serverIds = new Set(serverCart.map((l) => l.productId))
        const localOnly = local.filter((l) => !serverIds.has(l.productId) && l.quantity > 0)
        const merged = localOnly.length ? [...serverCart, ...localOnly] : serverCart
        if (localOnly.length) sendReplace(merged)
        if (!cancelled) {
          linesRef.current = merged
          setLines(merged)
          writeLocalCart(merged)
        }
      } catch {
        // Offline or API hiccup - keep whatever localStorage had.
      } finally {
        if (!cancelled) setHydrated(true)
      }
    }
    void reconcile()
    return () => { cancelled = true }
  }, [fetchServerCart, sendReplace])

  // Signed-in visitors can make changes in another tab / device (or log in
  // without a full reload). When this tab regains focus, pull the DB cart so
  // both surfaces stay in sync — unless a local write is still in flight, in
  // which case adopting the server state would clobber it.
  useEffect(() => {
    let visible = true
    async function onVisible() {
      if (!visible) return
      if (document.visibilityState !== 'visible') return
      if (pendingWritesRef.current > 0) return
      // Throttle: only re-sync if we have not synced in the last few seconds.
      if (Date.now() - lastSyncedAtRef.current < 3000) return
      const data = await fetchServerCart()
      if (!data || !data.authenticated) return
      lastSyncedAtRef.current = Date.now()
      if (pendingWritesRef.current > 0) return
      commit(data.cart)
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      visible = false
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [commit, fetchServerCart])

  const persist = useCallback((next: CartLine[]) => {
    commit(next)
    if (linesRef.current.length === 0) {
      sendReplace([])
      return
    }
    if (authenticated === false) return
    sendReplace(next)
  }, [authenticated, commit, sendReplace])

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
    sendReplace([])
  }, [commit, sendReplace])

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
