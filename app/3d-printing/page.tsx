import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowUpRight } from 'lucide-react'
import PageIntro from '../../components/PageIntro'
import PageShell from '../../components/PageShell'
import ModelBrowser from '../../components/ModelBrowser'

export const metadata: Metadata = {
  title: '3D Printing',
  description: 'Prototype printing, design for print, and small-batch fabrication for makers, students, and product teams in Nepal.',
}

const offers = [
  { title: 'Prototype printing', text: 'Turn a CAD file into a physical test part, enclosure, bracket, or teaching model.', meta: 'FDM · PLA / PETG' },
  { title: 'Design for print', text: 'Get help preparing geometry, tolerances, supports, and orientation before material is wasted.', meta: 'Consultancy · From NPR 2,500' },
  { title: 'Small-batch parts', text: 'Repeatable print runs for fixtures, replacement parts, classroom sets, and maker products.', meta: 'Quote by volume' },
]

export default function PrintingPage() {
  return (
    <PageShell>
      <PageIntro
        eyebrow="3D printing · new vertical"
        title="From a sketch to a thing you can hold."
        body="GENUM is adding print-to-order fabrication for Nepal makers, students, product teams, and classrooms. Start with a file, a reference object, or a rough idea."
      />

      <section className="mx-auto max-w-7xl px-5 py-10 sm:py-14 lg:px-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {offers.map((offer) => (
            <article key={offer.title} className="border-t-2 border-ink bg-white p-5 sm:p-6">
              <p className="text-xs font-black uppercase tracking-widest text-navy">{offer.meta}</p>
              <h2 className="mt-8 font-display text-xl font-bold sm:mt-12 sm:text-2xl">{offer.title}</h2>
              <p className="mt-3 leading-7 text-muted">{offer.text}</p>
              <Link href="/contact" className="mt-6 inline-flex h-12 items-center gap-1.5 rounded-full bg-navy px-5 text-sm font-black text-white transition hover:bg-navy-dark sm:mt-7">Request a quote <ArrowUpRight size={14} aria-hidden="true" /></Link>
            </article>
          ))}
        </div>

        <div className="mt-10 grid gap-6 border-y border-line py-8 sm:mt-12 sm:gap-8 sm:py-10 lg:grid-cols-[.8fr_1.2fr]">
          <div>
            <p className="text-xs font-black uppercase tracking-[.24em] text-navy">The workflow</p>
            <h2 className="mt-3 font-display text-2xl font-bold sm:text-3xl">A useful loop, not a mystery box.</h2>
          </div>
          <ol className="grid gap-4 sm:grid-cols-2">
            <li className="border-l-2 border-gold pl-4">
              <strong>01 · Share</strong>
              <p className="mt-1 text-sm leading-6 text-muted">Send an STL, STEP, sketch, or reference.</p>
            </li>
            <li className="border-l-2 border-gold pl-4">
              <strong>02 · Review</strong>
              <p className="mt-1 text-sm leading-6 text-muted">We check fit, material, supports, and finish.</p>
            </li>
            <li className="border-l-2 border-gold pl-4">
              <strong>03 · Print</strong>
              <p className="mt-1 text-sm leading-6 text-muted">You approve the estimate before the machine starts.</p>
            </li>
            <li className="border-l-2 border-gold pl-4">
              <strong>04 · Learn</strong>
              <p className="mt-1 text-sm leading-6 text-muted">Get the part plus notes for the next iteration.</p>
            </li>
          </ol>
        </div>

        <ModelBrowser />

        <div className="mt-10 flex flex-col gap-5 rounded-2xl bg-ink p-6 text-white sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-7">
          <div>
            <p className="text-xs font-black uppercase tracking-[.24em] text-gold">Have a file?</p>
            <h2 className="mt-2 font-display text-xl font-bold sm:text-2xl">Let us review the first print.</h2>
          </div>
          <Link href="/contact" className="inline-flex h-12 shrink-0 items-center gap-1.5 rounded-full bg-gold px-5 text-sm font-black text-ink transition hover:bg-gold-dark">Request a print review <ArrowUpRight size={14} aria-hidden="true" /></Link>
        </div>
      </section>
    </PageShell>
  )
}
