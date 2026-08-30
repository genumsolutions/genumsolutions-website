'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { LogOut, Menu, Moon, ShoppingBag, Sun, User, X } from 'lucide-react'
import HeaderSession from './HeaderSession'
import { useCart } from './cart-provider'
import { signOut } from '../lib/auth'

const nav = [
  { label: 'About', href: '/about' },
  { label: 'Services', href: '/services' },
  { label: 'Products', href: '/products' },
  { label: 'Projects', href: '/projects' },
  { label: 'Tools', href: '/tools' },
  { label: 'App', href: '/app' },
  { label: '3D Printing', href: '/3d-printing' },
  { label: 'Journal', href: '/journal' },
  { label: 'Contact', href: '/contact' },
]

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}

type SessionUser = { name: string; email: string; role: string }

export default function SiteHeader() {
  const pathname = usePathname()
  const [dim, setDim] = useState(false)
  const [open, setOpen] = useState(false)
  const [user, setUser] = useState<SessionUser | null>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const mobileNavRef = useRef<HTMLDivElement>(null)
  const { count, hydrated, clear } = useCart()

  // Keep the mobile menu session-aware so "Sign in" only appears for guests
  // and "My Account / Log out" appears for signed-in visitors, matching the
  // desktop HeaderSession control.
  useEffect(() => {
    fetch('/api/auth/session')
      .then((response) => response.json())
      .then((data) => { if (data.user) setUser(data.user) })
      .catch(() => undefined)
  }, [pathname])

  async function handleLogout() {
    clear()
    await signOut('/')
  }

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
    return `rounded-full px-3 py-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy ${
      active ? 'text-navy font-bold' : 'text-ink/60 hover:text-navy'
    }`
  }

  return (
    <header className="border-b border-line bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-5 sm:gap-4 sm:py-3.5 lg:px-8">
        <Link href="/" className="group flex shrink-0 items-center gap-3" aria-label="GENUM SOLUTIONS home">
          <span className="relative block h-11 w-11 shrink-0 overflow-hidden rounded-full bg-white shadow-card ring-1 ring-line transition group-hover:ring-navy/40 sm:h-14 sm:w-14">
            <Image src="/logo.png" alt="GENUM SOLUTIONS stamp" width={112} height={112} className="h-full w-full object-contain" priority />
          </span>
          <span aria-hidden="true" className="hidden h-10 w-px bg-line sm:block" />
          <span className="leading-none">
            <strong className="block font-display text-lg font-bold tracking-tight text-ink sm:text-[22px]">GENUM</strong>
            <span className="mt-1 block text-[9px] font-bold uppercase tracking-[0.32em] text-navy sm:text-[10px]">Solutions Pvt.&thinsp;Ltd.</span>
          </span>
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-1 text-sm text-ink/60 lg:flex">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className={linkClass(item.href)} aria-current={isActive(pathname ?? '', item.href) ? 'page' : undefined}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-2.5">
          <HeaderSession />
          <button
            onClick={toggleTheme}
            aria-label={dim ? 'Use light mode' : 'Use dim mode'}
            title={dim ? 'Light mode' : 'Dim mode'}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-white text-muted transition hover:border-navy hover:text-navy sm:h-9 sm:w-9"
          >
            {dim ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
          </button>
          <Link
            href="/checkout"
            aria-label={hydrated && count > 0 ? `Open checkout, ${count} item${count === 1 ? '' : 's'}` : 'Open checkout'}
            className="relative flex h-10 w-10 items-center justify-center rounded-full bg-ink text-white transition hover:bg-navy sm:h-9 sm:w-9"
          >
            <ShoppingBag size={16} aria-hidden="true" />
            {hydrated && count > 0 && (
              <span aria-hidden="true" className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-black text-ink">
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
            className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-white text-ink transition hover:border-navy hover:text-navy sm:h-9 sm:w-9 lg:hidden"
          >
            {open ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
          </button>
        </div>
      </div>

      <div id="mobile-navigation" ref={mobileNavRef}>
        {open && (
          <nav aria-label="Mobile" className="border-t border-line bg-white px-4 py-4 sm:px-5 lg:hidden animate-fade-in-up">
            <ul className="grid grid-cols-2 gap-1.5 text-sm">
              {nav.map((item) => {
                const active = isActive(pathname ?? '', item.href)
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={`flex h-12 items-center rounded-lg px-3 font-semibold transition ${active ? 'bg-navy text-white' : 'text-ink hover:bg-mist'}`}
                      aria-current={active ? 'page' : undefined}
                    >
                      {item.label}
                    </Link>
                  </li>
                )
              })}
              <li className="col-span-2 mt-1 border-t border-line pt-2">
                {user ? (
                  <div className="grid grid-cols-2 gap-1.5">
                    <Link href="/account" onClick={() => setOpen(false)} className="flex h-12 items-center justify-center rounded-lg border border-navy bg-white px-3 font-bold text-navy hover:bg-navy-light">
                      <User size={14} aria-hidden="true" className="mr-2" />
                      My Account
                    </Link>
                    <button onClick={handleLogout} className="flex h-12 items-center justify-center rounded-lg border border-red-200 bg-white px-3 font-bold text-red-600 hover:bg-red-50">
                      <LogOut size={14} aria-hidden="true" className="mr-2" />
                      Log out
                    </button>
                  </div>
                ) : (
                  <Link href="/login" onClick={() => setOpen(false)} className="flex h-12 items-center justify-center rounded-lg bg-navy px-3 font-bold text-white hover:bg-navy-dark">Sign in</Link>
                )}
              </li>
            </ul>
          </nav>
        )}
      </div>
    </header>
  )
}
