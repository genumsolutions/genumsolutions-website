'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

type SessionInfo = { name: string; role?: string }

// Lightweight session pill for the header: shows "Sign in" for guests,
// or the user's name plus logout once a session exists.
export default function HeaderSession() {
  const [session, setSession] = useState<SessionInfo | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    fetch('/api/customer/me')
      .then((response) => response.json())
      .then((data) => { if (data.customer) setSession({ name: data.customer.name || data.customer.email, role: data.customer.role }) })
      .catch(() => undefined)
      .finally(() => setReady(true))
  }, [])

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/'
  }

  if (!ready || !session) {
    return <Link href="/login" className="hidden rounded-full border border-line px-4 py-2 text-sm font-bold text-ink lg:block">Sign in</Link>
  }

  const isAdmin = session.role === 'admin'
  return (
    <div className="hidden items-center gap-2 lg:flex">
      {isAdmin && <Link href="/admin" className="rounded-full bg-signal px-4 py-2 text-sm font-black text-ink">Admin</Link>}
      <Link href="/account" className="max-w-[10rem] truncate rounded-full border border-line px-4 py-2 text-sm font-bold text-ink" title={session.name}>{session.name}</Link>
      <button onClick={logout} aria-label="Log out" title="Log out" className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-sm font-bold text-slate-500 hover:border-cobalt hover:text-cobalt">⎋</button>
    </div>
  )
}
