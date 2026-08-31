'use client'

// =====================================================================
// IotRemote - the single "test & play" surface for GENUM device control.
//
// Category selector on the left/top; the selected project's control panel
// renders below. This is the ONLY place controls live on the website - the
// Projects page is descriptions-only. Rendered inside the /tools page.
//
// A floating toolbar on the control frame offers:
//   - Fullscreen  : push the controller to the whole screen.
//   - Rotate      : rotate to landscape (native orientation lock on
//                   mobile when fullscreen; CSS 90deg fallback elsewhere).
//   - Lock        : freeze the control surface (pointer-events off) while
//                   keeping the connection alive, so a stray tap can't
//                   drive the device.
// =====================================================================

import { useEffect, useRef, useState } from 'react'
import { Lock, Maximize2, Minimize2, RotateCw, Unlock } from 'lucide-react'
import CategoryControlPanel from './CategoryControlPanel'
import { PROJECT_CATEGORIES } from '../lib/project-catalog'

type ScreenOrientationLocker = ScreenOrientation & {
  lock: (orientation: 'landscape' | 'portrait') => Promise<void>
  unlock: () => void
}

const locker = (): ScreenOrientationLocker | undefined => {
  const o = typeof screen !== 'undefined' ? (screen.orientation as never) : undefined
  return o ? (o as ScreenOrientationLocker) : undefined
}

function lockLandscape() {
  return locker()?.lock('landscape')
}

function unlockOrientation() {
  locker()?.unlock()
}

export default function IotRemote() {
  const [slug, setSlug] = useState<string>(PROJECT_CATEGORIES[0]!.slug)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [orientationLocked, setOrientationLocked] = useState(false)
  const [rotated, setRotated] = useState(false)
  const [locked, setLocked] = useState(false)
  const frameRef = useRef<HTMLDivElement | null>(null)

  const category = PROJECT_CATEGORIES.find((c) => c.slug === slug) ?? PROJECT_CATEGORIES[0]!

  useEffect(() => {
    const onChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
      if (!document.fullscreenElement) {
        setRotated(false)
        unlockOrientation()
        setOrientationLocked(false)
      }
    }
    document.addEventListener('fullscreenchange', onChange)
    return () => {
      document.removeEventListener('fullscreenchange', onChange)
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    }
  }, [])

  const toggleFullscreen = () => {
    const el = frameRef.current
    if (!el) return
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {})
    } else {
      el.requestFullscreen?.().catch(() => {})
    }
  }

  const toggleRotate = async () => {
    if (rotated) {
      setRotated(false)
      return
    }
    if (orientationLocked) {
      unlockOrientation()
      setOrientationLocked(false)
      return
    }
    try {
      const p = lockLandscape()
      if (p) {
        await p
        setOrientationLocked(true)
        return
      }
    } catch {
      /* native lock unavailable / not fullscreen -> CSS fallback below */
    }
    setRotated(true)
  }

  const frameClass = [
    'remote-frame',
    isFullscreen ? 'is-fullscreen' : '',
    rotated ? 'is-rotated' : '',
    locked ? 'is-locked' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <section className="mx-auto max-w-7xl px-5 py-10 lg:px-8 lg:py-12">
      <p className="text-[10px] font-black uppercase tracking-widest text-navy">
        IoT &amp; Remote Controller
      </p>
      <h2 className="mt-2 max-w-2xl font-display text-3xl font-bold text-ink lg:text-4xl">
        Test &amp; control your projects.
      </h2>
      <p className="mt-4 max-w-2xl text-base leading-7 text-muted lg:text-lg">
        Pick a project category, connect a Bluetooth or WiFi device, and drive or
        operate it live.
      </p>

      {/* Category selector */}
      <div className="mt-8 flex flex-wrap gap-2" role="tablist" aria-label="Project category">
        {PROJECT_CATEGORIES.map((c) => {
          const active = c.slug === slug
          return (
            <button
              key={c.slug}
              role="tab"
              aria-selected={active}
              onClick={() => setSlug(c.slug)}
              className={`rounded-full px-4 py-2 text-xs font-bold transition ${
                active ? 'bg-navy text-white' : 'border border-line bg-white text-muted hover:border-navy hover:text-navy'
              }`}
            >
              {c.name}
            </button>
          )
        })}
      </div>

      {/* Control frame: fullscreen / rotate / lock target */}
      <div ref={frameRef} className={frameClass}>
        {/* Floating toolbar */}
        <div className="sticky top-4 z-10 mb-3 flex items-center gap-1.5 rounded-full border border-line bg-white/90 p-1 shadow-card backdrop-blur">
          <span className="hidden px-2 text-[10px] font-black uppercase tracking-widest text-muted sm:block">
            {isFullscreen ? 'Fullscreen' : 'Controller'}
          </span>
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-ink transition hover:bg-navy hover:text-white"
          >
            {isFullscreen ? <Minimize2 size={16} aria-hidden="true" /> : <Maximize2 size={16} aria-hidden="true" />}
          </button>
          <button
            type="button"
            onClick={() => void toggleRotate()}
            aria-label={rotated || orientationLocked ? 'Return to portrait' : 'Rotate to landscape'}
            title={rotated || orientationLocked ? 'Return to portrait' : 'Rotate to landscape'}
            className={`inline-flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-navy hover:text-white ${rotated || orientationLocked ? 'bg-navy text-white' : 'text-ink'}`}
          >
            <RotateCw size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setLocked((v) => !v)}
            aria-label={locked ? 'Unlock controls' : 'Lock controls'}
            title={locked ? 'Unlock controls' : 'Lock controls'}
            className={`inline-flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-navy hover:text-white ${locked ? 'bg-navy text-white' : 'text-ink'}`}
          >
            {locked ? <Unlock size={16} aria-hidden="true" /> : <Lock size={16} aria-hidden="true" />}
          </button>
        </div>

        <CategoryControlPanel key={category.slug} category={category} />

        {locked && (
          <div className="pointer-events-none absolute inset-y-0 left-0 right-0 z-10 flex items-center justify-center rounded-2xl bg-white/40 backdrop-blur-sm">
            <p className="flex items-center gap-2 rounded-full bg-ink px-5 py-2 text-sm font-black text-white shadow-card">
              <Lock size={14} aria-hidden="true" /> Controls locked
            </p>
          </div>
        )}
      </div>
    </section>
  )
}
