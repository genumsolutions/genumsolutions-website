'use client'

import { useEffect, useState } from 'react'
import { Download, Smartphone, X } from 'lucide-react'
import { company } from '../lib/company'

const APK_URL = 'https://bkylfnlybtsujwzropru.supabase.co/storage/v1/object/public/app-releases/genum-solutions-latest.apk'
const APK_VERSION = '1.3.1'
const APK_SIZE = '23 MB'
const APK_ARCH = 'Android · 64-bit'

// Slide-in sticky bottom sticker. Hidden when the visitor has dismissed it
// (persisted locally) or when the site is being shown inside the native app
// WebView (window.GENUM_APP is set there) — in-app the app has its own update
// flow, so a redundant "download the app" prompt would be noise.
export default function AppBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      if (typeof (window as { GENUM_APP?: unknown }).GENUM_APP !== 'undefined') return
      setVisible(true)
    } catch {
      setVisible(false)
    }
  }, [])

  function dismiss() {
    setVisible(false)
  }

  if (!visible) return null

  return (
    <aside
      role="complementary"
      aria-label="Get the GENUM app"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 px-4 py-3 shadow-[0_-8px_24px_rgba(15,23,42,0.12)] backdrop-blur"
    >
      <div className="mx-auto flex max-w-7xl items-center gap-3 sm:gap-4 lg:px-4">
        <span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-navy sm:flex" aria-hidden="true">
          <Smartphone size={20} className="text-white" />
        </span>
        <p className="min-w-0 flex-1 text-sm">
          <strong className="block truncate font-display font-bold text-ink sm:inline">
            Get the {company.shortName} app
          </strong>
          <span className="mt-0.5 block text-xs leading-5 text-muted sm:mt-0 sm:inline sm:before:mx-2 sm:before:content-['·']">
            Browsing, orders, tools &amp; device controls · v{APK_VERSION} · {APK_ARCH}
          </span>
        </p>
        <a
          href={APK_URL}
          className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-navy px-4 text-xs font-black text-white transition hover:bg-navy-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy sm:px-5"
        >
          <Download size={15} aria-hidden="true" />
          <span className="hidden sm:inline">Download {APK_VERSION}</span>
          <span className="sm:hidden">Get it</span>
        </a>
        <button
          onClick={dismiss}
          aria-label="Dismiss app download prompt"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-mist hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      <p className="sr-only">{APK_SIZE} · signed by {company.name} · no app store needed</p>
    </aside>
  )
}
