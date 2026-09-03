import Link from 'next/link'
import type { Metadata } from 'next'
import ArticleCard from '../../components/ArticleCard'
import PageIntro from '../../components/PageIntro'
import PageShell from '../../components/PageShell'
import { listServices } from '../../lib/services'
import {
  getCurriculumHighlights,
  getPilotCosts,
  getTrainingPrograms,
} from '../../lib/programs-store'

export const metadata: Metadata = {
  title: 'Services & Training',
  description: 'Web delivery, 3D printing, school STEM packages, teacher workshops, and training programs from GENUM Solutions.',
}

const processSteps = [
  ['01', 'Share the outcome', 'Tell us what you need to sell, print, teach, publish, or build.'],
  ['02', 'Shape the scope', 'We recommend the right mix of content, materials, sessions, files, and delivery milestones.'],
  ['03', 'Review the quote', 'You receive clear pricing in NPR, lead times, inclusions, and optional upgrades.'],
  ['04', 'Deliver and hand over', 'We test, document, train, and leave you with a practical next step.'],
]

export const dynamic = 'force-dynamic'

export default async function ServicesPage() {
  const services = await listServices()
  // Training / pilot-cost / curriculum content comes from the DB (shared
  // tables, same source the native app reads) with bundled fallback.
  const [trainingPrograms, pilotCosts, stemProjectHighlights] = await Promise.all([
    getTrainingPrograms(),
    getPilotCosts(),
    getCurriculumHighlights(),
  ])
  return (
    <PageShell>
      <PageIntro
        eyebrow="Services · training · fabrication"
        title="Useful support from first idea to finished result."
        body="GENUM combines web delivery, robotics education, 3D and 2D printing, school packages, training programs, and design support for students, schools, institutions, hobbyists, and businesses."
      />

      {/* ─── Services ─── */}
      <section id="services" className="mx-auto max-w-7xl px-5 py-10 sm:py-14 lg:px-8">
        <p className="text-xs font-black uppercase tracking-[.24em] text-navy">What we offer</p>
        <h2 className="mt-2 font-display text-2xl font-bold tracking-tight sm:text-3xl">Our Services</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => (
            <ArticleCard key={s.id} tag={s.tag || s.category} title={s.name} description={s.description}>
              <p className="mt-2 text-lg font-bold text-ink">{s.priceLabel}</p>
              <Link href="/contact" className="mt-4 inline-block text-sm font-black text-navy underline decoration-gold decoration-2 underline-offset-4">
                Request a quote
              </Link>
            </ArticleCard>
          ))}
          {services.length === 0 && (
            <p className="col-span-full py-8 text-sm text-slate-500">Services are being set up. Contact us for details.</p>
          )}
        </div>

        <div className="mt-12 grid gap-8 border-y border-line py-8 sm:py-10 lg:grid-cols-[.8fr_1.2fr]">
          <div>
            <p className="text-xs font-black uppercase tracking-[.24em] text-navy">How it works</p>
            <h3 className="mt-3 font-display text-2xl font-bold sm:text-3xl">Clear scope before commitment.</h3>
            <p className="mt-4 leading-7 text-slate-600">For websites, print jobs, workshops, and lab projects, we separate the deliverables, materials, schedule, and handover so the next step is easy to approve.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {processSteps.map(([number, title, text]) => (
              <div key={number} className="border-l-2 border-gold pl-4">
                <p className="text-xs font-black text-navy">{number} · {title}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Training Programs ─── */}
      <section id="training" className="border-y border-line bg-mist">
        <div className="mx-auto max-w-7xl px-5 py-10 sm:py-14 lg:px-8">
          <p className="text-xs font-black uppercase tracking-[.24em] text-navy">Training programs</p>
          <h2 className="mt-2 font-display text-2xl font-bold tracking-tight sm:text-3xl">Programs that Build Careers</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            GENUM&apos;s source curriculum combines 100+ age-banded STEM projects with
            modular robotics, teacher enablement, and measurable pilot support.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {trainingPrograms.map((program) => (
              <ArticleCard key={program.title} variant="rounded" title={program.title} description={program.description}>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-gold">{program.audience}</p>
                  <span className="rounded-full bg-sky px-3 py-1 text-xs font-bold text-navy">{program.duration}</span>
                </div>
                <p className="mt-3 text-xs leading-5 text-slate-500"><strong className="text-ink">Outcome:</strong> {program.outcome}</p>
              </ArticleCard>
            ))}
          </div>
        </div>
      </section>

      {/* ─── School Packages & Pilot Costs ─── */}
      <section id="pilots" className="mx-auto max-w-7xl px-5 py-10 sm:py-14 lg:px-8">
        <div className="grid gap-8 sm:gap-10 lg:grid-cols-[.9fr_1.1fr]">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[.24em] text-navy">Illustrative pilot costing</p>
            <h2 className="mt-3 font-display text-2xl font-bold tracking-tight sm:text-3xl">A transparent starting point for a school proposal.</h2>
            <p className="mt-4 leading-7 text-slate-600">
              The source proposal models a three-classroom pilot with 30 kits. These figures are illustrative, shown
              in NPR for planning, and confirmed after scope, taxes, delivery, and local procurement review.
            </p>
            <p className="mt-5 font-display text-2xl font-bold text-navy sm:text-3xl">NPR 8,40,000 <span className="font-sans text-sm font-normal text-slate-500">illustrative total</span></p>
            <div className="mt-8 overflow-x-auto">
              <table className="w-full min-w-[320px] sm:min-w-[400px] text-left text-sm">
                <caption className="sr-only">Illustrative three-classroom pilot cost breakdown in NPR</caption>
                <thead>
                  <tr className="border-b border-line text-xs uppercase tracking-wider text-slate-400">
                    <th scope="col" className="py-2 pr-4 font-bold">Line item</th>
                    <th scope="col" className="py-2 font-bold">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {pilotCosts.map(({ item, cost, note }) => (
                    <tr key={item} className="border-b border-line last:border-b-0">
                      <th scope="row" className="py-3 pr-4 align-top font-semibold text-ink">
                        {item}
                        <span className="block text-xs font-normal leading-5 text-slate-500">{note}</span>
                      </th>
                      <td className="py-3 align-top font-display font-bold">{cost}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="min-w-0">
            <h3 className="font-display text-2xl font-bold tracking-tight">STEM Project Highlights</h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">Age-banded project examples from our 100+ project curriculum catalog.</p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {stemProjectHighlights.map(({ ageBand, items }) => (
                <div key={ageBand} className="rounded-2xl border border-line bg-white p-5">
                  <p className="text-xs font-black uppercase tracking-widest text-gold">{ageBand}</p>
                  <ul className="mt-3 space-y-1.5 text-sm leading-6 text-slate-600">
                    {items.map((project) => <li key={project}>{project}</li>)}
                  </ul>
                </div>
              ))}
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/contact" className="inline-flex h-12 items-center rounded-full bg-navy px-6 text-sm font-bold text-white transition hover:bg-navy-dark">Request a school proposal</Link>
              <Link href="/products" className="inline-flex h-12 items-center rounded-full border border-line bg-white px-6 text-sm font-black text-ink transition hover:border-navy hover:text-navy">Browse products</Link>
            </div>
          </div>
        </div>
      </section>
    </PageShell>
  )
}
