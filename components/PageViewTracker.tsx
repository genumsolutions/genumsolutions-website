'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

// Lightweight page-view beacon. Fires once per route change via POST to /api/track.
export default function PageViewTracker() {
  const pathname = usePathname()

  useEffect(() => {
    if (!pathname) return
    const controller = new AbortController()
    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: pathname, referrer: document.referrer || null }),
      signal: controller.signal,
      keepalive: true,
    }).catch(() => undefined)
    return () => controller.abort()
  }, [pathname])

  return null
}
