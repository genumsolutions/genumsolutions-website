'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, Download, Smartphone, X } from 'lucide-react'
import { company } from '../lib/company'

const APK_URL = 'https://bkylfnlybtsujwzropru.supabase.co/storage/v1/object/public/app-releases/genum-solutions-latest.apk'
const APK_VERSION = '1.4.0'
const APK_SIZE = '28 MB'
const APK_ARCH = 'Android · 64-bit'
const STORAGE_KEY = 'genum-app-version'

type BannerState =
  | { kind: 'prompt' } // never downloaded -> "Get the app"
  | { kind: 'up-to-date'; installed: string } // installed version == APK_VERSION
  | { kind: 'update-available'; installed: string } // installed version < APK_VERSION

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

function readInstalled(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function rememberInstalled(version: string) {
  try {
    window.localStorage.setItem(STORAGE_KEY, version)
  } catch {
    // Storage unavailable - banner will simply show the prompt again next time.
  }
}

// Slide-in sticky bottom sticker for the GENUM app. In the native app's WebView
// (window.GENUM_APP) the app has its own update flow, so this prompt is hidden.
// For web visitors we remember the last installed APK version and:
//   - no record  -> show the download prompt
//   - same       -> show "up to date" (can dismiss, stays hidden)
//   - outdated   -> show "update available"
export default function AppBanner() {
  const [state, setState] = useState<BannerState | 'hidden' | null>(null)

  useEffect(() => {
    try {
      if (typeof (window as { GENUM_APP?: unknown }).GENUM_APP !== 'undefined') {
        setState('hidden')
        return
      }
      const installed = readInstalled()
      if (installed && !isNewer(APK_VERSION, installed)) {
        setState({ kind: 'up-to-date', installed })
        return
      }
      if (installed) {
        setState({ kind: 'update-available', installed })
        return
      }
      setState({ kind: 'prompt' })
    } catch {
      setState({ kind: 'prompt' })
    }
  }, [])

  function dismiss() {
    setState('hidden')
  }

  if (!state || state === 'hidden') return null

  const installedBadge =
    state.kind === 'prompt' ? null : (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
        <CheckCircle2 size={13} aria-hidden="true" />
        {state.kind === 'update-available' ? (
          <>v{state.installed} installed · update to v{APK_VERSION}</>
        ) : (
          <>v{APK_VERSION} installed · up to date</>
        )}
      </span>
    )

  return (
    <aside
      role="complementary"
      aria-label="Get the GENUM app"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 px-4 py-3 shadow-[0_-8px_24px_rgba(15,23,42,0.10)] backdrop-blur"
    >
      <div className="mx-auto flex max-w-7xl items-center gap-3 sm:gap-4 lg:px-4">
        <span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-navy sm:flex" aria-hidden="true">
          <Smartphone size={20} className="text-white" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-display font-bold text-ink">
            {state.kind === 'prompt' ? `Get the ${company.shortName} app` : 'GENUM app'}
          </p>
          {installedBadge ? (
            <div className="mt-1">{installedBadge}</div>
          ) : (
            <span className="mt-0.5 block text-xs leading-5 text-muted">
              Browsing, orders, tools &amp; device controls · v{APK_VERSION} · {APK_ARCH}
            </span>
          )}
        </div>

        {state.kind === 'prompt' ? (
          <a
            href={APK_URL}
            onClick={() => rememberInstalled(APK_VERSION)}
            className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-navy px-4 text-xs font-black text-white transition hover:bg-navy-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy sm:px-5"
          >
            <Download size={15} aria-hidden="true" />
            <span className="hidden sm:inline">Download {APK_VERSION}</span>
            <span className="sm:hidden">Get it</span>
          </a>
        ) : state.kind === 'update-available' ? (
          <a
            href={APK_URL}
            onClick={() => rememberInstalled(APK_VERSION)}
            className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-navy px-4 text-xs font-black text-white transition hover:bg-navy-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy sm:px-5"
          >
            <Download size={15} aria-hidden="true" />
            Update
          </a>
        ) : null}

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
