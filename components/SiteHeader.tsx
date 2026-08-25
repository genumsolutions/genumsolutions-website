'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import HeaderSession from './HeaderSession'
import { useCart } from './cart-provider'

const nav = [
  { label: 'About', href: '/about' },
  { label: 'Services', href: '/services' },
  { label: 'Products', href: '/products' },
  { label: 'Robot Cars', href: '/robot-cars' },
  { label: 'Projects', href: '/projects' },
  { label: 'Tools', href: '/tools' },
  { label: '3D Printing', href: '/3d-printing' },
  { label: 'Training', href: '/training' },
  { label: 'Journal', href: '/journal' },
  { label: 'Contact', href: '/contact' },
]

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}

export default function SiteHeader() {
  const pathname = usePathname()
  const [dim, setDim] = useState(false)
  const [open, setOpen] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const mobileNavRef = useRef<HTMLDivElement>(null)
  const { count, hydrated } = useCart()

  useEffect(() => {
    const saved = window.localStorage.getItem('genum-theme') === 'dim'
    setDim(saved)
    document.documentElement.dataset.theme = saved ? 'dim' : 'light'
  }, [])

  useEffect(() => { setOpen(false) }, [pathname])

  useEffect(() => {
    if (!open) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') { setOpen(false); menuButtonRef.current?.focus() }
    }
    function onClickOutside(event: MouseEvent) {
      if (!mobileNavRef.current?.contains(event.target as Node) && !menuButtonRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('mousedown', onClickOutside)
    return () => { document.removeEventListener('keydown', onKeyDown); document.removeEventListener('mousedown', onClickOutside) }
  }, [open])

  const toggleTheme = useCallback(() => {
    setDim((current) => {
      const next = !current
      document.documentElement.dataset.theme = next ? 'dim' : 'light'
      window.localStorage.setItem('genum-theme', next ? 'dim' : 'light')
      return next
    })
  }, [])

  const linkClass = (href: string) => {
    const active = isActive(pathname ?? '', href)
    return `rounded-full px-2.5 py-1 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cobalt ${
      active ? 'text-cobalt font-bold' : 'text-ink/60 hover:text-cobalt'
    }`
  }

  return (
    <header className="border-b border-line bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3.5 lg:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-3" aria-label="GENUM SOLUTIONS home">
          <Image src="/logo.png" alt="GENUM SOLUTIONS stamp" width={48} height={48} className="h-10 w-10 object-contain" priority />
          <span className="leading-none">
            <strong className="font-display text-lg font-bold text-ink">GENUM</strong>
            <span className="block text-[9px] font-bold uppercase tracking-[.25em] text-cobalt">Solutions Pvt. Ltd.</span>
          </span>
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-1 text-sm text-ink/60 xl:flex">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className={linkClass(item.href)} aria-current={isActive(pathname ?? '', item.href) ? 'page' : undefined}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2.5">
          <HeaderSession />
          <button
            onClick={toggleTheme}
            aria-label={dim ? 'Use light mode' : 'Use dim mode'}
            title={dim ? 'Light mode' : 'Dim mode'}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-white text-sm text-ink transition hover:border-cobalt hover:text-cobalt"
          >
            {dim ? '☀' : <span aria-hidden="true">◐</span>}
          </button>
          <Link
            href="/checkout"
            aria-label={hydrated && count > 0 ? `Open checkout, ${count} item${count === 1 ? '' : 's'}` : 'Open checkout'}
            className="relative flex h-9 w-9 items-center justify-center rounded-full bg-ink text-sm text-white transition hover:bg-cobalt"
          >
            ⌑
            {hydrated && count > 0 && (
              <span aria-hidden="true" className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-signal px-1 text-[10px] font-black text-ink">
                {count}
              </span>
            )}
          </Link>
          <button
            ref={menuButtonRef}
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-controls="mobile-navigation"
            aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-white text-ink transition hover:border-cobalt hover:text-cobalt lg:hidden"
          >
            {open ? (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8" /></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M2 4h12M2 8h12M2 12h12" /></svg>
            )}
          </button>
        </div>
      </div>

      <div id="mobile-navigation" ref={mobileNavRef}>
        {open && (
          <nav aria-label="Mobile" className="border-t border-line bg-white px-5 py-4 lg:hidden">
            <ul className="grid grid-cols-2 gap-1 text-sm">
              {nav.map((item) => {
                const active = isActive(pathname ?? '', item.href)
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={`block rounded-lg px-3 py-2.5 font-semibold transition ${active ? 'bg-cobalt text-white' : 'text-ink hover:bg-mist'}`}
                      aria-current={active ? 'page' : undefined}
                    >
                      {item.label}
                    </Link>
                  </li>
                )
              })}
              <li className="col-span-2 mt-1 border-t border-line pt-2">
                <Link href="/account" onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2.5 font-semibold text-cobalt hover:bg-cobalt-light">My Account</Link>
              </li>
              <li className="col-span-2">
                <Link href="/login" onClick={() => setOpen(false)} className="block rounded-lg bg-cobalt px-3 py-2.5 text-center font-bold text-white hover:bg-cobalt-dark">Sign in</Link>
              </li>
            </ul>
          </nav>
        )}
      </div>
    </header>
  )
}
