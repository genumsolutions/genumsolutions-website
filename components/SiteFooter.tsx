import Image from 'next/image'
import Link from 'next/link'
import { company } from '../lib/company'

const shopLinks = [
  { href: '/services', label: 'Services' },
  { href: '/products', label: 'Shop' },
  { href: '/training', label: 'Training' },
  { href: '/3d-printing', label: '3D Printing' },
  { href: '/tools', label: 'Tools' },
  { href: '/projects', label: 'Projects' },
]

const supportLinks = [
  { href: '/contact', label: 'Contact' },
  { href: '/account', label: 'My account' },
  { href: '/privacy', label: 'Privacy Policy' },
  { href: '/terms', label: 'Terms of Service' },
]

export default function SiteFooter() {
  return (
    <footer className="border-t border-line bg-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-12 text-sm lg:grid-cols-[1.2fr_1fr_1fr] lg:px-8">
        <div>
          <Link href="/" className="flex items-center gap-3" aria-label="GENUM SOLUTIONS home">
            <Image src="/logo.png" alt="GENUM SOLUTIONS stamp" width={38} height={38} className="h-9 w-9 object-contain" />
            <span>
              <strong className="font-display">{company.shortName}</strong>
              <span className="block text-xs text-slate-500">Pvt. Ltd. · {company.city}, {company.country === 'NP' ? 'Nepal' : company.country}</span>
            </span>
          </Link>
          <p className="mt-4 max-w-md leading-6 text-slate-500">
            Robotics, electronics, AI, IoT, 3D printing, digital products, and practical technology training from Kathmandu, Nepal.
          </p>
          <address className="mt-4 space-y-1 not-italic text-slate-500">
            <p>{company.address}</p>
            <p>
              <a href={`tel:${company.phone.replace(/\s/g, '')}`} className="transition hover:text-cobalt">{company.phone}</a>
              {' · '}
              <a href={`mailto:${company.email}`} className="transition hover:text-cobalt">{company.email}</a>
            </p>
            <p className="text-xs">
              <span className="rounded bg-sky px-1.5 py-0.5 font-bold text-cobalt">{company.vatLabel}</span> PAN {company.pan}
            </p>
          </address>
        </div>

        <nav aria-label="Shop navigation" className="text-xs font-bold text-slate-500">
          <h2 className="text-[11px] font-black uppercase tracking-[.2em] text-slate-400">Explore</h2>
          <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-2">
            {shopLinks.map((link) => (
              <li key={link.href}><Link href={link.href} className="transition hover:text-cobalt hover:underline">{link.label}</Link></li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Support and legal" className="text-xs font-bold text-slate-500">
          <h2 className="text-[11px] font-black uppercase tracking-[.2em] text-slate-400">Support &amp; legal</h2>
          <ul className="mt-4 grid gap-y-3">
            {supportLinks.map((link) => (
              <li key={link.href}><Link href={link.href} className="transition hover:text-cobalt hover:underline">{link.label}</Link></li>
            ))}
          </ul>
          <p className="mt-4 font-normal leading-5 text-slate-400">Payments: eSewa · Khalti · Cash on delivery</p>
        </nav>
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-wrap justify-between gap-3 px-5 py-4 text-xs text-slate-400 lg:px-8">
          <span>© 2026 {company.name} · PAN {company.pan}</span>
          <span>Built in Kathmandu, delivered across Nepal.</span>
        </div>
      </div>
    </footer>
  )
}
