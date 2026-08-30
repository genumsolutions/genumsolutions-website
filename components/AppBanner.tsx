'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, Download, HelpCircle, Smartphone, X } from 'lucide-react'
import { androidApp, company } from '../lib/company'

const DISMISS_KEY = 'genum-app-banner-dismissed'
const SEEN_KEY = 'genum-app-version'

type BannerState =
  | { kind: 'show' }
  // We only record that a download was attempted — never "installed", because
  // the web page cannot verify what's actually on the device.
  | { kind: 'downloaded'; version: string }
  | { kind: 'hidden' }

// Compare dotted "x.y.z" versions numerically.
function isNewer(a: string, b: string) {
  const pa = a.split('.').map((n) => Number(n) || 0)
  const pb = b.split('.').map((n) => Number(n) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return true
    if ((pa[i] || 0) < (pb[i] || 0)) return false
  }
  return false
}

function readJSON<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function writeJSON(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage unavailable - defaults apply.
  }
}

function initState(): BannerState {
  try {
    // The native app's WebView runs its own update flow, so hide the prompt.
    if (typeof (window as { GENUM_APP?: unknown }).GENUM_APP !== 'undefined') {
      return { kind: 'hidden' }
    }
  } catch {
    /* ignore */
  }
  const dismissedAt = readJSON<number>(DISMISS_KEY)
  // Respect the user's dismissal for a while; always recoverable from the app page.
  if (dismissedAt && Date.now() - dismissedAt < 12 * 60 * 60 * 1000) {
    return { kind: 'hidden' }
  }
  const seen = readJSON<{ version: string; at: number }>(SEEN_KEY)
  if (seen) {
    return { kind: 'downloaded', version: seen.version }
  }
  return { kind: 'show' }
}

// Slide-in sticky bottom sticker for the GENUM app. The web page cannot detect
// whether the APK is actually installed, so we never claim "up to date" — this
// banner always offers a download / reinstall path, and points to /app for full
// instructions and direct links.
export default function AppBanner() {
  const [state, setState] = useState<BannerState | null>(null)

  useEffect(() => {
    setState(initState())
  }, [])

  // Auto-hide returning visitors' banner after a while; it stays reachable from
  // the footer / /app page at any time.
  useEffect(() => {
    if (state && state.kind !== 'hidden') {
      const timer = window.setTimeout(() => setState({ kind: 'hidden' }), 20_000)
      return () => window.clearTimeout(timer)
    }
  }, [state])

  if (!state || state.kind === 'hidden') return null

  const previouslyDownloaded = state.kind === 'downloaded'
  const outdated = previouslyDownloaded && isNewer(androidApp.version, state.version)

  function recordDownload() {
    writeJSON(SEEN_KEY, { version: androidApp.version, at: Date.now() })
  }

  function dismiss() {
    writeJSON(DISMISS_KEY, Date.now())
    setState({ kind: 'hidden' })
  }

  return (
    <aside
      role="complementary"
      aria-label="Get the GENUM app for Android"
      className="fixed inset-x-0 bottom-0 z-40 px-3 pb-3 sm:px-4 sm:pb-4"
    >
      <div className="mx-auto flex max-w-3xl items-center gap-3 rounded-2xl border border-line bg-white/95 p-3 pl-3 shadow-[0_-8px_40px_rgba(15,23,42,0.14)] backdrop-blur sm:gap-4 sm:p-4 sm:pl-4">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-navy to-navy-dark text-white ring-1 ring-navy/20 sm:h-12 sm:w-12"
          aria-hidden="true"
        >
          <Smartphone size={22} />
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-display font-bold text-ink">
            {outdated ? 'Update available' : 'Get the GENUM app'}
          </p>
          <p className="mt-0.5 text-xs leading-5 text-muted">
            Browsing, orders, tools &amp; device controls · v{androidApp.version} · {androidApp.sizeLabel} ·{' '}
            {androidApp.arch}
          </p>
          {previouslyDownloaded && !outdated && (
            <p className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-emerald-700">
              <CheckCircle2 size={12} aria-hidden="true" />
              v{state.version} download available — reinstall anytime
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            href={androidApp.appsPagePath}
            className="hidden items-center gap-1.5 rounded-full border border-line px-3 py-2 text-xs font-bold text-ink transition hover:border-navy hover:text-navy md:inline-flex"
          >
            <HelpCircle size={14} aria-hidden="true" />
            How to install
          </Link>
          <a
            href={androidApp.apkUrl}
            download
            onClick={recordDownload}
            className="inline-flex h-10 items-center gap-2 rounded-full bg-navy px-4 text-xs font-black text-white shadow-sm transition hover:bg-navy-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy sm:h-11 sm:px-5"
          >
            <Download size={15} aria-hidden="true" />
            {previouslyDownloaded ? `Reinstall v${androidApp.version}` : `Download v${androidApp.version}`}
          </a>
          <button
            onClick={dismiss}
            aria-label="Dismiss app download prompt"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-mist hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
      </div>
      <p className="sr-only">
        {androidApp.sizeLabel} · signed by {company.name} · no app store needed
      </p>
    </aside>
  )
}
