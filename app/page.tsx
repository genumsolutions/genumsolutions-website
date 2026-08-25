import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import PageShell from '../components/PageShell'
import { getProductMedia } from '../lib/product-media'
import { trainingPrograms, pilotCosts, stemProjectHighlights } from '../lib/programs'
import { getSiteContent } from '../lib/content-store'

export const revalidate = 300

export async function generateMetadata(): Promise<Metadata> {
  const content = await getSiteContent()
  return {
    title: content.homeTitle,
    description: content.homeBody,
    alternates: { canonical: '/' },
    openGraph: {
      title: `${content.homeTitle} | GENUM SOLUTIONS`,
      description: content.homeBody,
      url: '/',
      type: 'website',
      siteName: 'GENUM SOLUTIONS',
      locale: 'en_NP',
      images: [{ url: '/logo.png', width: 512, height: 512, alt: 'GENUM SOLUTIONS official stamp' }],
    },
    twitter: { card: 'summary', title: content.homeTitle, description: content.homeBody, images: ['/logo.png'] },
  }
}

const services = [
  { title: 'Robotics kits & components', body: 'Controllers, motors, sensors, and full robot-car platforms sourced and tested in Kathmandu.', href: '/products', cta: 'Browse catalog' },
  { title: '3D & 2D printing', body: 'Prototypes, spare parts, and signage printed to spec with materials advice included.', href: '/3d-printing', cta: 'Printing services' },
  { title: 'School STEM packages', body: 'Kits, curriculum, teacher training, and coaching bundled into a single pilot program.', href: '/training', cta: 'See programs' },
  { title: 'Custom projects & labs', body: 'IoT, AI prototypes, workshop setups, and lab consultation delivered end to end.', href: '/services', cta: 'Start a proposal' },
]

const stats = [
  ['100+', 'Curriculum projects'],
  ['4', 'Payment options incl. COD'],
  ['1–2', 'Day dispatch in Nepal'],
  ['7-day', 'Component replacement'],
]

export default async function HomePage() {
  const heroMedia = getProductMedia('Robotics')
  const content = await getSiteContent()

  return (
    <PageShell>
      <main>
        <section className="grid-paper border-b border-line">
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 py-16 lg:grid-cols-[1.1fr_.9fr] lg:gap-14 lg:px-8 lg:py-24">
            <div>
              <p className="mb-5 flex items-center gap-2 text-xs font-black uppercase tracking-[.24em] text-cobalt">
                <span className="h-2 w-2 rounded-full bg-signal" aria-hidden="true" /> Kathmandu · Nepal
              </p>
              <h1 className="max-w-3xl font-display text-4xl font-bold leading-[1.05] tracking-[-.03em] text-ink sm:text-6xl lg:text-7xl lg:leading-[.98]">
                Technology you can <span className="text-cobalt">touch</span>, test, and trust.
              </h1>
              <p className="mt-7 max-w-xl text-base leading-7 text-slate-600">
                Robotics kits, project solutions, fabrication, open tools, and training for curious builders,
                schools, and teams — designed in Kathmandu, delivered across Nepal, with eSewa, Khalti, card,
                and cash-on-delivery payment.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Link
                  href="/products"
                  className="rounded-full bg-cobalt px-6 py-3.5 text-sm font-black text-white shadow-sm transition hover:bg-blue-800 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cobalt"
                >
                  Get started
                </Link>
                <Link
                  href="/contact"
                  className="rounded-full border border-line bg-white px-6 py-3.5 text-sm font-black text-ink transition hover:border-cobalt hover:text-cobalt focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cobalt"
                >
                  Contact us
                </Link>
              </div>
              <dl className="mt-12 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-line pt-8 sm:grid-cols-4">
                {stats.map(([value, label]) => (
                  <div key={label}>
                    <dt className="order-last mt-1 text-xs leading-5 text-slate-500">{label}</dt>
                    <dd className="font-display text-2xl font-bold text-ink">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="relative overflow-hidden rounded-3xl bg-ink shadow-2xl">
              <Image
                src={heroMedia.src}
                alt={heroMedia.alt}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 45vw"
                className="object-cover opacity-90"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/90 to-transparent p-6 text-white">
                <p className="text-xs font-black uppercase tracking-[.2em] text-signal">Build what matters</p>
                <p className="mt-2 max-w-xs font-display text-2xl font-bold leading-snug">From first circuit to real-world launch.</p>
              </div>
            </div>
          </div>
        </section>

        <section aria-labelledby="services-heading" className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-20">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="text-xs font-black uppercase tracking-[.24em] text-cobalt">What GENUM does</p>
              <h2 id="services-heading" className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">A practical build partner.</h2>
            </div>
            <Link
              href="/services"
              className="text-sm font-black text-cobalt underline decoration-signal decoration-2 underline-offset-4 transition hover:text-blue-800"
            >
              View all services →
            </Link>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {services.map((service) => (
              <article key={service.title} className="flex flex-col rounded-2xl border border-line bg-white p-6 transition hover:-translate-y-0.5 hover:border-cobalt hover:shadow-lg">
                <h3 className="font-display text-lg font-bold leading-snug">{service.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">{service.body}</p>
                <Link href={service.href} className="mt-4 inline-flex items-center gap-1 text-sm font-black text-cobalt transition hover:gap-2" aria-label={`${service.cta}: ${service.title}`}>
                  {service.cta} <span aria-hidden="true">→</span>
                </Link>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="curriculum-heading" className="border-y border-line bg-mist py-16 lg:py-20">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[.24em] text-cobalt">100+ project curriculum</p>
                <h2 id="curriculum-heading" className="mt-2 max-w-2xl font-display text-3xl font-bold tracking-tight sm:text-4xl">Ages, materials, and outcomes stay visible.</h2>
              </div>
              <Link href="/contact" className="text-sm font-black text-cobalt underline decoration-signal decoration-2 underline-offset-4 transition hover:text-blue-800">
                Request the full catalog →
              </Link>
            </div>
            <ul className="mt-8 grid gap-4 md:grid-cols-3">
              {stemProjectHighlights.map(([ages, ...projects]) => (
                <li key={ages} className="rounded-2xl border border-line bg-white p-6">
                  <p className="text-xs font-black uppercase tracking-widest text-signal">{ages}</p>
                  <ul className="mt-4 space-y-2 text-sm leading-6 text-slate-600">
                    {projects.map((project) => <li key={project}>{project}</li>)}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby="training-heading" className="mx-auto grid max-w-7xl gap-10 px-5 py-16 lg:grid-cols-[.9fr_1.1fr] lg:px-8 lg:py-20">
          <div>
            <p className="text-xs font-black uppercase tracking-[.24em] text-cobalt">Illustrative pilot costing</p>
            <h2 id="training-heading" className="mt-3 font-display text-3xl font-bold tracking-tight">A transparent starting point for a school proposal.</h2>
            <p className="mt-4 leading-7 text-slate-600">
              The source proposal models a three-classroom pilot with 30 kits. These figures are illustrative, shown
              in NPR for planning, and confirmed after scope, taxes, delivery, and local procurement review.
            </p>
            <p className="mt-5 font-display text-3xl font-bold text-cobalt">NPR 8,40,000 <span className="font-sans text-sm font-normal text-slate-500">illustrative total</span></p>
            <table className="mt-8 w-full text-left text-sm">
              <caption className="sr-only">Illustrative three-classroom pilot cost breakdown in NPR</caption>
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-wider text-slate-400">
                  <th scope="col" className="py-2 pr-4 font-bold">Line item</th>
                  <th scope="col" className="py-2 font-bold">Cost</th>
                </tr>
              </thead>
              <tbody>
                {pilotCosts.map(([item, cost, note]) => (
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
          <div>
            <h3 className="font-display text-2xl font-bold tracking-tight">Our training programs</h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              From a single robotics lab to a three-classroom pilot with kits, curriculum, teacher training,
              coaching, and reporting.
            </p>
            <ul className="mt-6 space-y-4">
              {trainingPrograms.map((program) => (
                <li key={program.title} className="rounded-2xl border border-line bg-white p-6">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="font-display text-lg font-bold">{program.title}</h4>
                    <span className="rounded-full bg-sky px-3 py-1 text-xs font-bold text-cobalt">{program.duration}</span>
                  </div>
                  <p className="mt-1 text-xs font-bold uppercase tracking-wide text-signal">{program.audience}</p>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{program.description}</p>
                  <p className="mt-3 text-xs leading-5 text-slate-500"><strong className="text-ink">Outcome:</strong> {program.outcome}</p>
                </li>
              ))}
            </ul>
            <Link
              href="/training"
              className="mt-7 inline-block rounded-full bg-signal px-6 py-3.5 text-sm font-black text-ink transition hover:bg-yellow-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
            >
              See training programs →
            </Link>
          </div>
        </section>

        <section className="border-t border-line bg-ink">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-6 px-5 py-14 text-white lg:flex-nowrap lg:px-8">
            <div>
              <p className="text-xs font-black uppercase tracking-[.24em] text-signal">Need a starting point?</p>
              <h2 className="mt-2 max-w-xl font-display text-3xl font-bold tracking-tight">Use the open tools or bring us the brief.</h2>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/tools" className="rounded-full bg-white px-6 py-3.5 text-sm font-black text-ink transition hover:bg-mist focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">Open tools</Link>
              <Link href="/contact" className="rounded-full border border-white/40 px-6 py-3.5 text-sm font-black text-white transition hover:border-white hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">Contact GENUM</Link>
            </div>
          </div>
        </section>
      </main>
    </PageShell>
  )
}
