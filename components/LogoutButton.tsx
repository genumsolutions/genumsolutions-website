'use client'

// Client-side logout for server-rendered pages (e.g. the admin header form).
export default function LogoutButton({ className }: { className?: string }) {
  return (
    <button
      onClick={async () => {
        await fetch('/api/auth/logout', { method: 'POST' })
        window.location.href = '/login'
      }}
      className={className || 'border border-line px-4 py-2 text-sm font-bold text-ink'}
    >
      Log out
    </button>
  )
}
