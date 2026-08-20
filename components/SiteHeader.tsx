'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'

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

export default function SiteHeader() {
  const [dim, setDim] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const saved = window.localStorage.getItem('genum-theme') === 'dim'
    setDim(saved)
    document.documentElement.dataset.theme = saved ? 'dim' : 'light'
  }, [])

  function toggleTheme() {
    const next = !dim
    setDim(next)
    document.documentElement.dataset.theme = next ? 'dim' : 'light'
    window.localStorage.setItem('genum-theme', next ? 'dim' : 'light')
  }

  return <header className="border-b border-line bg-white/90 backdrop-blur"><div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8"><Link href="/" className="flex items-center gap-3" onClick={() => setOpen(false)}><Image src="/logo.png" alt="GENUM SOLUTIONS stamp" width={48} height={48} className="h-11 w-11 object-contain" /><span className="leading-none"><strong className="font-display text-lg">GENUM</strong><span className="block text-[9px] font-bold uppercase tracking-[.25em] text-cobalt">Solutions Pvt. Ltd.</span></span></Link><nav className="hidden items-center gap-6 text-sm font-bold text-slate-500 lg:flex">{nav.map((item) => <Link key={item.href} href={item.href} className="hover:text-cobalt">{item.label}</Link>)}</nav><div className="flex items-center gap-2"><button onClick={toggleTheme} aria-label={dim ? 'Use light mode' : 'Use dim mode'} title={dim ? 'Light mode' : 'Dim mode'} className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-white text-lg text-ink">{dim ? '☼' : '◐'}</button><Link href="/checkout" aria-label="Open checkout" className="relative flex h-10 w-10 items-center justify-center rounded-full bg-ink text-lg text-white">⌑</Link><button onClick={() => setOpen(!open)} aria-label="Open navigation" className="rounded-full border border-line px-4 py-2 text-sm font-bold lg:hidden">Menu</button></div></div>{open && <nav className="border-t border-line px-5 py-4 lg:hidden"><div className="grid gap-4 text-sm font-bold">{nav.map((item) => <Link key={item.href} href={item.href} onClick={() => setOpen(false)}>{item.label}</Link>)}</div></nav>}</header>
}
