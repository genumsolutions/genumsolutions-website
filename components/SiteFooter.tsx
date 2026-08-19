import Image from 'next/image'
import Link from 'next/link'
import { company } from '../lib/company'

export default function SiteFooter() {
  return <footer className="border-t border-line bg-white"><div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-8 text-sm sm:flex-row sm:items-center sm:justify-between lg:px-8"><Link href="/" className="flex items-center gap-3"><Image src="/logo.png" alt="GENUM SOLUTIONS stamp" width={38} height={38} className="h-9 w-9 object-contain" /><span><strong className="font-display">{company.shortName}</strong><span className="block text-xs text-slate-500">{company.address}</span></span></Link><div className="flex flex-wrap gap-5 text-xs font-bold text-slate-500"><Link href="/services">Services</Link><Link href="/products">Shop</Link><Link href="/3d-printing">3D Printing</Link><Link href="/contact">Contact</Link><span>© 2026</span></div></div></footer>
}
