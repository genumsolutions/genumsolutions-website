import Link from 'next/link'
import Image from 'next/image'
import { Metadata } from 'next'
import PageShell from '../components/PageShell'
import { getProductMedia } from '../lib/product-media'
import { trainingPrograms } from '../lib/programs'
import { getSiteContent } from '../lib/content-store'
import { formatNPR } from '../lib/catalog'
import { RoboticArm } from '../components/Robotics3D'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const content = await getSiteContent()
  return {
    title: content.homeTitle,
    description: content.homeBody
  }
}

export default async function HomePage() {
  const heroMedia = getProductMedia('Robotics')
  const content = await getSiteContent()

  return (
    <PageShell>
      <main>
        <section className="grid-paper border-b border-line">
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 py-16 lg:grid-cols-[1.1fr_.9fr] lg:px-8 lg:py-24">
            <div>
              <p className="mb-5 flex items-center gap-2 text-xs font-black uppercase tracking-[.24em] text-cobalt">
                <span className="h-2 w-2 rounded-full bg-signal" /> Kathmandu · Nepal
              </p>
              <h1 className="max-w-3xl font-display text-5xl font-bold leading-[.98] tracking-[-.04em] text-ink sm:text-7xl">
                Technology you can
                <span className="text-cobalt">touch</span>, test, and trust.
              </h1>
              <p className="mt-7 max-w-xl text-base leading-7 text-slate-600">
                Robotics kits, project solutions, fabrication, open tools, and training for curious builders, schools, and teams - designed in Kathmandu, delivered across Nepal, with eSewa, Khalti, card, and cash-on-delivery payment.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Link href="/products" className="rounded-full bg-cobalt px-6 py-3.5 text-sm font-black text-white">
                  Explore the catalog
                </Link>
                <Link href="/contact" className="rounded-full border border-line bg-white px-6 py-3.5 text-sm font-black text-ink">
                  Start a proposal
                </Link>
              </div>
            </div>
            <div className="relative overflow-hidden rounded-3xl bg-ink shadow-2xl lg:mt-0 lg:mx-0">
              <img
                src={heroMedia.src}
                alt={heroMedia.alt}
                className="aspect-[4/3] w-full object-cover opacity-90"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/90 to-transparent p-6 text-white">
                <p className="text-xs font-black uppercase tracking-[.2em] text-signal">Build what matters</p>
                <p className="mt-2 max-w-xs font-display text-2xl font-bold">From first circuit to real-world launch.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-16 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="text-xs font-black uppercase tracking-[.24em] text-cobalt">What GENUM does</p>
              <h2 className="mt-2 font-display text-4xl font-bold">A practical build partner.</h2>
            </div>
            <div>
              <Link href="/services" className="text-sm font-black text-cobalt underline decoration-signal decoration-2 underline-offset-4">
                View services ?
              </Link>
            </div>
          </div>
        </section>

        <section className="mt-16 border-y border-line py-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[.24em] text-cobalt">100+ project curriculum</p>
              <h2 className="mt-2 font-display text-3xl font-bold">Ages, materials, and outcomes stay visible.</h2>
            </div>
            <a href="/contact" className="text-sm font-black text-cobalt underline decoration-signal decoration-2 underline-offset-4">
              Request the full catalog ?
            </a>
          </div>
        </section>

        <section className="mt-8 grid gap-4 lg:grid-cols-[.8fr_1.2fr]">
          <div>
            <p className="text-xs font-black uppercase tracking-[.24em] text-cobalt">Illustrative pilot costing</p>
            <h2 className="mt-3 font-display text-3xl font-bold">A transparent starting point for a school proposal.</h2>
            <p className="mt-4 leading-7 text-slate-600">
              The source proposal models a three-classroom pilot with 30 kits. These figures are illustrative, shown in NPR for planning, and confirmed after scope, taxes, delivery, and local procurement review.
            </p>
            <p className="mt-5 font-display text-3xl font-bold text-cobalt">NPR 8,40,000 <span className="text-sm font-sans font-normal text-slate-500">illustrative total</span></p>
          </div>
          <div>
            <h3 className="font-display text-xl font-bold">Our Training Programs</h3>
            <p className="mt-4 text-sm leading-6 text-slate-500">
              Programs from a single robotics lab to a three-classroom pilot with kits, curriculum, teacher training, coaching, and reporting.
            </p>
            <Link href="/training" className="mt-7 inline-block rounded-full bg-signal px-5 py-3 text-sm font-black text-ink">See training programs ?</Link>
          </div>
          <div>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="border-t border-white/20 pt-4">
                <p className="text-xs font-black uppercase tracking-widest text-signal">Age Group {i}</p>
                <h3 className="mt-3 font-display text-xl font-bold">Program Title {i}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">Program outcome {i}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-5 border-t border-line px-5 py-14 lg:px-8">
          <div>
            <p className="text-xs font-black uppercase tracking-[.24em] text-cobalt">Need a starting point?</p>
            <h2 className="mt-2 font-display text-3xl font-bold">Use the open tools or bring us the brief.</h2>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/tools" className="rounded-full bg-ink px-5 py-3 text-sm font-black text-white">Open tools ?</Link>
            <Link href="/contact" className="rounded-full border border-line bg-white px-5 py-3 text-sm font-black text-ink">Contact GENUM</Link>
          </div>
        </section>
      </main>
    </PageShell>
  )
}