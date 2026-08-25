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

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!open) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
        menuButtonRef.current?.focus()
      }
    }
    function onClickOutside(event: MouseEvent) {
      if (!mobileNavRef.current?.contains(event.target as Node) && !menuButtonRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('mousedown', onClickOutside)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('mousedown', onClickOutside)
    }
  }, [open])

  const toggleTheme = useCallback(() => {
    setDim((current) => {
      const next = !current
      document.documentElement.dataset.theme = next ? 'dim' : 'light'
      window.localStorage.setItem('genum-theme', next ? 'dim' : 'light')
      return next
    })
  }, [])

  const linkClass = (href: string) =>
    `rounded-full px-1 py-1 transition hover:text-cobalt focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cobalt ${
      isActive(pathname ?? '', href) ? 'text-cobalt underline decoration-signal decoration-2 underline-offset-8' : ''
    }`

  return (
    <header className="border-b border-line bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 lg:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-3" aria-label="GENUM SOLUTIONS home">
          <Image src="/logo.png" alt="GENUM SOLUTIONS stamp" width={48} height={48} className="h-11 w-11 object-contain" />
          <span className="leading-none">
            <strong className="font-display text-lg">GENUM</strong>
            <span className="block text-[9px] font-bold uppercase tracking-[.25em] text-cobalt">Solutions Pvt. Ltd.</span>
          </span>
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-5 text-sm font-bold text-slate-500 xl:flex">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className={linkClass(item.href)} aria-current={isActive(pathname ?? '', item.href) ? 'page' : undefined}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <HeaderSession />
          <button
            onClick={toggleTheme}
            aria-label={dim ? 'Use light mode' : 'Use dim mode'}
            title={dim ? 'Light mode' : 'Dim mode'}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-white text-lg text-ink transition hover:border-cobalt"
          >
            {dim ? '☼' : <span aria-hidden="true">◐</span>}
          </button>
          <Link
            href="/checkout"
            aria-label={hydrated && count > 0 ? `Open checkout, ${count} item${count === 1 ? '' : 's'} in build list` : 'Open checkout'}
            className="relative flex h-10 w-10 items-center justify-center rounded-full bg-ink text-lg text-white transition hover:bg-cobalt"
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
            className="rounded-full border border-line px-4 py-2 text-sm font-bold transition hover:border-cobalt hover:text-cobalt lg:hidden"
          >
            Menu
          </button>
        </div>
      </div>

      <div id="mobile-navigation" ref={mobileNavRef}>
        {open && (
          <nav aria-label="Mobile" className="border-t border-line px-5 py-4 lg:hidden">
            <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm font-bold">
              {nav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={`block rounded-lg px-3 py-2 ${isActive(pathname ?? '', item.href) ? 'bg-sky text-cobalt' : 'text-slate-600 hover:bg-mist'}`}
                    aria-current={isActive(pathname ?? '', item.href) ? 'page' : undefined}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/account" onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2 text-cobalt hover:bg-mist">Account</Link>
              </li>
            </ul>
          </nav>
        )}
      </div>
    </header>
  )
}
