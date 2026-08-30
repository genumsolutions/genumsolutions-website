import Image from 'next/image'
import Link from 'next/link'
import { company } from '../lib/company'

const shopLinks = [
  { href: '/services', label: 'Services & Training' },
  { href: '/products', label: 'Shop' },
  { href: '/3d-printing', label: '3D Printing' },
  { href: '/tools', label: 'Tools' },
  { href: '/projects', label: 'Projects' },
]

const supportLinks = [
  { href: '/contact', label: 'Contact' },
  { href: '/app', label: 'Download app' },
  { href: '/account', label: 'My account' },
  { href: '/privacy', label: 'Privacy Policy' },
  { href: '/terms', label: 'Terms of Service' },
]

export default function SiteFooter() {
  return (
    <footer className="border-t border-line bg-ink text-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 text-sm sm:gap-10 sm:py-12 sm:grid-cols-2 lg:grid-cols-[1.2fr_1fr_1fr] lg:px-8">
        <div className="sm:col-span-2 lg:col-span-1">
          <Link href="/" className="flex items-center gap-3 sm:gap-3.5" aria-label="GENUM SOLUTIONS home">
            <Image src="/logo.png" alt="GENUM SOLUTIONS stamp" width={88} height={88} className="h-10 w-10 shrink-0 rounded-full object-contain ring-1 ring-white/20 sm:h-11 sm:w-11" />
            <span aria-hidden="true" className="hidden h-9 w-px bg-white/20 sm:block" />
            <span className="leading-none">
              <strong className="block font-display text-xl font-bold tracking-tight text-white">{company.shortName}</strong>
              <span className="mt-1.5 block text-[10px] font-bold uppercase tracking-[0.3em] text-white/60">Solutions Pvt.&thinsp;Ltd.</span>
            </span>
          </Link>
          <p className="mt-4 max-w-md leading-6 text-white/60">
            Robotics, electronics, AI, IoT, 3D printing, digital products, and practical technology training from Kathmandu, Nepal.
          </p>
          <address className="mt-4 space-y-1 not-italic text-white/60">
            <p>{company.address}</p>
            <p>
              <a href={`tel:${company.phone.replace(/\s/g, '')}`} className="transition hover:text-gold">{company.phone}</a>
              {' · '}
              <a href={`mailto:${company.email}`} className="transition hover:text-gold">{company.email}</a>
            </p>
            <p className="text-xs">
              <span className="rounded bg-navy/20 px-1.5 py-0.5 font-bold text-navy">{company.vatLabel}</span> PAN {company.pan}
            </p>
          </address>
        </div>

        <nav aria-label="Shop navigation" className="text-xs font-bold text-white/60">
          <h2 className="text-[11px] font-black uppercase tracking-[.2em] text-white/30">Explore</h2>
          <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-2">
            {shopLinks.map((link) => (
              <li key={link.href}><Link href={link.href} className="transition hover:text-gold hover:underline">{link.label}</Link></li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Support and legal" className="text-xs font-bold text-white/60">
          <h2 className="text-[11px] font-black uppercase tracking-[.2em] text-white/30">Support &amp; legal</h2>
          <ul className="mt-4 grid gap-y-3">
            {supportLinks.map((link) => (
              <li key={link.href}><Link href={link.href} className="transition hover:text-gold hover:underline">{link.label}</Link></li>
            ))}
          </ul>
          <p className="mt-4 font-normal leading-5 text-white/30">Payments: eSewa · Khalti · Cash on delivery</p>
        </nav>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-wrap justify-between gap-3 px-5 py-4 text-xs text-white/30 lg:px-8">
          <span>© 2026 {company.name} · PAN {company.pan}</span>
          <span>Built in Kathmandu, delivered across Nepal.</span>
        </div>
      </div>
    </footer>
  )
}
