import PageIntro from '../../components/PageIntro'
import PageShell from '../../components/PageShell'

const services = [
  ['Website Design & Development', 'from NPR 35,000', 'Fast, responsive business websites, content systems, and online stores for schools, institutions, makers, and growing teams.', 'Website'],
  ['3D Printing Services', 'from NPR 2,500', 'Custom parts, prototypes, enclosures, classroom models, filament guidance, and design support. Send a model for a print quote.', 'Fabrication'],
  ['2D Printing Press', 'Request a quote', 'Flyers, posters, student reports, branding materials, stickers, and banners for schools, events, and businesses.', 'Print'],
  ['Robotics Workshops', 'from NPR 25,000', 'Hands-on sessions for students, hobbyists, clubs, and teaching institutions using practical robotics builds.', 'Learning'],
  ['School Packages', 'Scoped proposal', 'Kits plus teacher enablement, curriculum support, classroom delivery, and a structured robotics lab starting point.', 'Education'],
  ['Robotics Lab Consultation', 'Request a quote', 'Plan a lab around available space, learner age, inventory, safety, project progression, and equipment priorities.', 'Consulting'],
]

const process = [
  ['01', 'Share the outcome', 'Tell us what you need to sell, print, teach, publish, or build.'],
  ['02', 'Shape the scope', 'We recommend the right mix of content, materials, sessions, files, and delivery milestones.'],
  ['03', 'Review the quote', 'You receive clear pricing in NPR, lead times, inclusions, and optional upgrades.'],
  ['04', 'Deliver and hand over', 'We test, document, train, and leave you with a practical next step.'],
]

export default function ServicesPage() {
  return <PageShell><PageIntro eyebrow="Services · printing · learning" title="Useful support from first idea to finished result." body="GENUM combines website delivery, robotics education, 3D and 2D printing, school packages, and design support for students, schools, institutions, hobbyists, and businesses." /><section className="mx-auto max-w-7xl px-5 py-14 lg:px-8"><div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{services.map(([name, price, text, tag]) => <article key={name} className="border-t-2 border-ink bg-white p-6"><p className="text-xs font-black uppercase tracking-widest text-cobalt">{tag}</p><h2 className="mt-10 font-display text-2xl font-bold">{name}</h2><p className="mt-3 text-lg font-bold text-ink">{price}</p><p className="mt-3 leading-7 text-slate-600">{text}</p><a className="mt-8 inline-block text-sm font-black text-cobalt underline decoration-signal decoration-2 underline-offset-4" href="/contact">Request a quote ↗</a></article>)}</div><div className="mt-16 grid gap-8 border-y border-line py-10 lg:grid-cols-[.8fr_1.2fr]"><div><p className="text-xs font-black uppercase tracking-[.24em] text-cobalt">How it works</p><h2 className="mt-3 font-display text-3xl font-bold">Clear scope before commitment.</h2><p className="mt-4 leading-7 text-slate-600">For websites, print jobs, workshops, and lab projects, we separate the deliverables, materials, schedule, and handover so the next step is easy to approve.</p></div><div className="grid gap-4 sm:grid-cols-2">{process.map(([number, title, text]) => <div key={number} className="border-l-2 border-signal pl-4"><p className="text-xs font-black text-cobalt">{number} · {title}</p><p className="mt-2 text-sm leading-6 text-slate-600">{text}</p></div>)}</div></div></section></PageShell>
}
