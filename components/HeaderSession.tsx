'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { initials } from '../lib/identity'
import { useCart } from './cart-provider'

type SessionUser = { name: string; email: string; role: string }

// Header session control: a "Sign in" pill for guests, or an initials avatar
// opening a menu with account links and logout. Uses /api/auth/session, which
// returns identity only - no carts or messages - so it stays cheap.
export default function HeaderSession() {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [ready, setReady] = useState(false)
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const { clear } = useCart()

  useEffect(() => {
    fetch('/api/auth/session')
      .then((response) => response.json())
      .then((data) => { if (data.user) setUser(data.user) })
      .catch(() => undefined)
      .finally(() => setReady(true))
  }, [])

  useEffect(() => {
    if (!open) return
    function onOutside(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function onEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    document.addEventListener('keydown', onEscape)
    return () => {
      document.removeEventListener('mousedown', onOutside)
      document.removeEventListener('keydown', onEscape)
    }
  }, [open])

  async function logout() {
    setOpen(false)
    clear()
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/'
  }

  if (!ready) return <span className="h-10 w-28 animate-pulse rounded-full border border-line" aria-hidden="true" />

  if (!user) {
    return <Link href="/login" className="rounded-full bg-cobalt px-5 py-2 text-sm font-black text-white transition hover:bg-cobalt-dark">Sign in</Link>
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${user.name}`}
        title={user.name}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-cobalt text-xs font-black tracking-wide text-white ring-offset-2 hover:ring-2 hover:ring-cobalt"
      >
        {initials(user.name)}
      </button>

      {open && (
        <div role="menu" className="absolute right-0 z-50 mt-2 w-64 border border-line bg-white shadow-xl animate-scale-in">
          <div className="border-b border-line px-4 py-3">
            <p className="truncate text-sm font-black text-ink">{user.name}</p>
            <p className="mt-0.5 truncate text-xs text-slate-500">{user.email}</p>
            {user.role === 'admin' && <span className="mt-2 inline-block rounded-full bg-signal px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-ink">Admin</span>}
          </div>
          <div className="p-1.5">
            <Link href="/account" role="menuitem" onClick={() => setOpen(false)} className="block px-3 py-2 text-sm font-bold text-ink hover:bg-mist">Your account</Link>
            {user.role === 'admin' && <Link href="/admin" role="menuitem" onClick={() => setOpen(false)} className="block px-3 py-2 text-sm font-bold text-ink hover:bg-mist">Admin dashboard</Link>}
            <button onClick={logout} role="menuitem" className="block w-full px-3 py-2 text-left text-sm font-bold text-red-600 hover:bg-red-50">Log out</button>
          </div>
        </div>
      )}
    </div>
  )
}
