'use client'

import { useEffect } from 'react'
import { onCLS, onINP, onLCP, onTTFB } from 'web-vitals'

// Reports Core Web Vitals to the existing /api/track endpoint so the admin
// dashboard can show real-user performance alongside page views.
export default function WebVitals() {
  useEffect(() => {
    function report(name: string, value: number) {
      try {
        const body = JSON.stringify({ path: `__vitals:${name}`, referrer: String(Math.round(value)) })
        navigator.sendBeacon('/api/track', new Blob([body], { type: 'application/json' }))
      } catch {
        // Reporting must never break the page.
      }
    }
    onCLS((metric) => report('CLS', metric.value))
    onINP((metric) => report('INP', metric.value))
    onLCP((metric) => report('LCP', metric.value))
    onTTFB((metric) => report('TTFB', metric.value))
  }, [])

  return null
}
