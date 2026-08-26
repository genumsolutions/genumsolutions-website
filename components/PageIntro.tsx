import Image from 'next/image'
import BrandMotif from './BrandMotif'

export default function PageIntro({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return <section className="grid-paper border-b border-line"><div className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-24"><div className="flex max-w-3xl items-start gap-6"><div className="hidden items-center gap-3 sm:flex"><Image src="/logo.png" alt="GENUM stamp" width={72} height={72} className="h-16 w-16 object-contain" /><BrandMotif /></div><div><p className="text-xs font-black uppercase tracking-[.24em] text-navy">{eyebrow}</p><h1 className="mt-3 font-display text-5xl font-bold tracking-[-.04em] text-ink">{title}</h1><p className="mt-5 max-w-2xl text-base leading-7 text-slate-600">{body}</p></div></div></div></section>
}
