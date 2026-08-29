import type { Metadata } from 'next'
import Link from 'next/link'
import { WifiOff } from 'lucide-react'
import PageShell from '../../components/PageShell'
import { company } from '../../lib/company'

export const metadata: Metadata = {
  title: 'You are offline',
  robots: { index: false, follow: false },
}

const links = [
  { href: '/', label: 'Home' },
  { href: '/products', label: 'Products' },
  { href: '/tools', label: 'Tools' },
]

export default function OfflinePage() {
  return (
    <PageShell>
      <main id="main-content" className="grid min-h-[60vh] place-items-center px-5 py-16 lg:px-8">
        <div className="mx-auto w-full max-w-xl text-center">
          <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-sky text-navy">
            <WifiOff size={30} aria-hidden="true" />
          </span>
          <h1 className="mt-6 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            You&apos;re offline
          </h1>
          <p className="mt-4 leading-7 text-slate-600">
            You&apos;re not connected to the internet right now, so this page couldn&apos;t be
            loaded. Pages you have visited recently may still be available below.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="inline-flex h-11 items-center rounded-full bg-navy px-6 text-sm font-bold text-white transition hover:bg-navy-dark"
              >
                {link.label}
              </Link>
            ))}
          </div>

          <p className="mt-8 text-sm leading-6 text-slate-500">
            When your connection returns, just refresh. Need help?{' '}
            <Link href="/contact" className="font-bold text-navy underline decoration-navy decoration-2 underline-offset-4 hover:text-navy-dark">
              Contact {company.shortName}
            </Link>
            .
          </p>
        </div>
      </main>
    </PageShell>
  )
}
