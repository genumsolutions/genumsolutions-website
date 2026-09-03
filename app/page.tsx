import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import { ArrowRight } from 'lucide-react'
import PageShell from '../components/PageShell'
import { getProductMedia } from '../lib/product-media'
import { getTrainingPrograms } from '../lib/programs-store'
import { getSiteContent } from '../lib/content-store'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const content = await getSiteContent()
  return {
    title: content.homeTitle,
    description: content.homeBody,
    alternates: { canonical: '/' },
    openGraph: {
      title: content.homeTitle,
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
  { title: 'School STEM packages', body: 'Kits, curriculum, teacher training, and coaching bundled into a single pilot program.', href: '/services#training', cta: 'See programs' },
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
  // Training programs render from the shared DB table (same source the app
  // reads) with the bundled list as fallback.
  const trainingPrograms = await getTrainingPrograms()

  return (
    <PageShell>
      <main>
        <section className="grid-paper border-b border-line">
          <div className="mx-auto grid max-w-7xl items-center gap-8 px-5 py-12 sm:py-16 lg:grid-cols-[1.1fr_.9fr] lg:gap-14 lg:px-8 lg:py-24">
            <div>
              <p className="mb-4 flex items-center gap-2 text-xs font-black uppercase tracking-[.24em] text-navy sm:mb-5">
                <span className="h-2 w-2 rounded-full bg-gold" aria-hidden="true" /> Kathmandu · Nepal
              </p>
              <h1 className="max-w-3xl font-display text-3xl font-bold leading-[1.1] tracking-[-.03em] text-ink sm:text-4xl sm:leading-[1.05] lg:text-6xl lg:leading-[.98]">
                Technology you can <span className="text-navy">touch</span>, test, and trust.
              </h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-slate-600 sm:mt-7 sm:text-lg">
                Robotics kits, project solutions, fabrication, open tools, and training for curious builders,
                schools, and teams — designed in Kathmandu, delivered across Nepal, with eSewa, Khalti, card,
                and cash-on-delivery payment.
              </p>
              <div className="mt-7 flex flex-wrap gap-3 sm:mt-9">
                <Link
                  href="/products"
                  className="inline-flex h-12 items-center rounded-full bg-navy px-6 text-sm font-bold text-white shadow-sm transition hover:bg-navy-dark hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
                >
                  Get started
                </Link>
                <Link
                  href="/contact"
                  className="inline-flex h-12 items-center rounded-full border border-line bg-white px-6 text-sm font-black text-ink transition hover:border-navy hover:text-navy focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
                >
                  Contact us
                </Link>
              </div>
              <dl className="mt-10 grid grid-cols-2 gap-x-4 gap-y-5 border-t border-line pt-8 sm:mt-12 sm:grid-cols-4 sm:gap-x-6">
                {stats.map(([value, label]) => (
                  <div key={label}>
                    <dt className="order-last mt-1 text-xs leading-5 text-slate-500">{label}</dt>
                    <dd className="font-display text-2xl font-bold text-ink">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="relative z-0 aspect-[4/3] overflow-hidden rounded-3xl bg-ink shadow-2xl sm:aspect-square lg:aspect-[4/3]">
              <Image
                src={heroMedia.src}
                alt={heroMedia.alt}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 45vw"
                className="object-cover opacity-90"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/90 to-transparent p-5 text-white sm:p-6">
                <p className="text-xs font-black uppercase tracking-[.2em] text-gold">Build what matters</p>
                <p className="mt-2 max-w-xs font-display text-xl font-bold leading-snug sm:text-2xl">From first circuit to real-world launch.</p>
              </div>
            </div>
          </div>
        </section>

        <section aria-labelledby="services-heading" className="mx-auto max-w-7xl px-5 py-12 lg:px-8 lg:py-20">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[.24em] text-navy">What GENUM does</p>
              <h2 id="services-heading" className="mt-2 font-display text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">A practical build partner.</h2>
            </div>
            <Link
              href="/services"
              className="inline-flex items-center gap-1.5 text-sm font-bold text-navy underline decoration-gold decoration-2 underline-offset-4 transition hover:text-navy-dark"
            >
              View all services <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {services.map((service) => (
              <article key={service.title} className="flex flex-col rounded-2xl border border-line bg-white p-5 transition hover:-translate-y-0.5 hover:border-navy hover:shadow-lg sm:p-6">
                <h3 className="font-display text-lg font-bold leading-snug">{service.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">{service.body}</p>
                <Link href={service.href} className="mt-4 inline-flex items-center gap-1.5 text-sm font-black text-navy transition hover:gap-2.5" aria-label={`${service.cta}: ${service.title}`}>
                  {service.cta} <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="training-heading" className="border-y border-line bg-mist py-12 lg:py-20">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[.24em] text-navy">100+ project curriculum</p>
                <h2 id="training-heading" className="mt-2 font-display text-2xl font-bold tracking-tight sm:text-3xl">Training programs that build careers.</h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">
                  From a single robotics lab to a three-classroom pilot with kits, curriculum, teacher training, coaching, and reporting.
                </p>
              </div>
              <Link href="/services#training" className="inline-flex items-center gap-1.5 text-sm font-bold text-navy underline decoration-gold decoration-2 underline-offset-4 transition hover:text-navy-dark">
                View all programs <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </div>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {trainingPrograms.map((program) => (
                <li key={program.title} className="flex flex-col rounded-2xl border border-line bg-white p-5 sm:p-6">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-display text-base font-bold leading-snug">{program.title}</h3>
                    <span className="shrink-0 whitespace-nowrap rounded-full bg-sky px-3 py-1 text-[10px] font-bold text-navy">{program.duration}</span>
                  </div>
                  <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-gold">{program.audience}</p>
                  <p className="mt-3 flex-1 text-xs leading-5 text-slate-600">{program.description}</p>
                  <p className="mt-3 text-[10px] leading-4 text-slate-500"><strong className="text-ink">Outcome:</strong> {program.outcome}</p>
                </li>
              ))}
            </ul>
            <Link
              href="/services"
              className="mt-7 inline-flex h-12 items-center gap-2 rounded-full bg-gold px-6 text-sm font-black text-ink transition hover:bg-gold-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
            >
              See all services & training <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
        </section>

        <section className="border-t border-line bg-ink">
          <div className="mx-auto grid max-w-7xl gap-6 px-5 py-12 text-white sm:grid-cols-1 sm:items-center sm:py-14 lg:grid-cols-[1fr_auto] lg:px-8">
            <div>
              <p className="text-xs font-black uppercase tracking-[.24em] text-gold">Need a starting point?</p>
              <h2 className="mt-2 max-w-xl font-display text-2xl font-bold tracking-tight sm:text-3xl">Use the open tools or bring us the brief.</h2>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/tools" className="inline-flex h-12 items-center rounded-full bg-white px-6 text-sm font-black text-ink transition hover:bg-mist focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">Open tools</Link>
              <Link href="/contact" className="inline-flex h-12 items-center rounded-full border border-white/40 px-6 text-sm font-black text-white transition hover:border-white hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">Contact GENUM</Link>
            </div>
          </div>
        </section>
      </main>
    </PageShell>
  )
}
