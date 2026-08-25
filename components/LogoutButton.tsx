'use client'

import { useCart } from './cart-provider'

// Client-side logout for server-rendered pages (e.g. the admin header form).
export default function LogoutButton({ className }: { className?: string }) {
  const { clear } = useCart()
  return (
    <button
      onClick={async () => {
        clear()
        await fetch('/api/auth/logout', { method: 'POST' })
        window.location.href = '/login'
      }}
      className={className || 'border border-line px-4 py-2 text-sm font-bold text-ink hover:border-red-300 hover:text-red-600'}
    >
      Log out
    </button>
  )
}
