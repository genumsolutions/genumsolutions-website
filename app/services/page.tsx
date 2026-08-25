import PageIntro from '../../components/PageIntro'
import PageShell from '../../components/PageShell'
import { listServices } from '../../lib/services'

const processSteps = [
  ['01', 'Share the outcome', 'Tell us what you need to sell, print, teach, publish, or build.'],
  ['02', 'Shape the scope', 'We recommend the right mix of content, materials, sessions, files, and delivery milestones.'],
  ['03', 'Review the quote', 'You receive clear pricing in NPR, lead times, inclusions, and optional upgrades.'],
  ['04', 'Deliver and hand over', 'We test, document, train, and leave you with a practical next step.'],
]

export default async function ServicesPage() {
  const services = await listServices()
  return (
    <PageShell>
      <PageIntro
        eyebrow="Services · printing · learning"
        title="Useful support from first idea to finished result."
        body="GENUM combines website delivery, robotics education, 3D and 2D printing, school packages, and design support for students, schools, institutions, hobbyists, and businesses."
      />
      <section className="mx-auto max-w-7xl px-5 py-14 lg:px-8">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => (
            <article key={s.id} className="border-t-2 border-ink bg-white p-6">
              <p className="text-xs font-black uppercase tracking-widest text-cobalt">{s.tag || s.category}</p>
              <h2 className="mt-10 font-display text-2xl font-bold">{s.name}</h2>
              <p className="mt-3 text-lg font-bold text-ink">{s.priceLabel}</p>
              <p className="mt-3 leading-7 text-slate-600">{s.description}</p>
              <a className="mt-8 inline-block text-sm font-black text-cobalt underline decoration-signal decoration-2 underline-offset-4" href="/contact">Request a quote ↗</a>
            </article>
          ))}
        </div>
        <div className="mt-16 grid gap-8 border-y border-line py-10 lg:grid-cols-[.8fr_1.2fr]">
          <div>
            <p className="text-xs font-black uppercase tracking-[.24em] text-cobalt">How it works</p>
            <h2 className="mt-3 font-display text-3xl font-bold">Clear scope before commitment.</h2>
            <p className="mt-4 leading-7 text-slate-600">For websites, print jobs, workshops, and lab projects, we separate the deliverables, materials, schedule, and handover so the next step is easy to approve.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {processSteps.map(([number, title, text]) => (
              <div key={number} className="border-l-2 border-signal pl-4">
                <p className="text-xs font-black text-cobalt">{number} · {title}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </PageShell>
  )
}
