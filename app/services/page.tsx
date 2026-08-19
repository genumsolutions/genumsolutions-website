import PageIntro from '../../components/PageIntro'
import PageShell from '../../components/PageShell'

const packages = [
  ['Web presence', 'from NPR 35,000', 'A sharp, fast web presence for a business ready to be found.', 'Digital'],
  ['Content system', 'from NPR 75,000', 'A flexible CMS your team can update without a developer.', 'Digital'],
  ['Commerce engine', 'from NPR 125,000', 'A storefront with catalog, payments, order workflows, and analytics.', 'Digital'],
  ['IoT prototype', 'from NPR 95,000', 'Connect sensors to a useful dashboard with data quality and handoff in mind.', 'Engineering'],
  ['3D print studio', 'from NPR 2,500', 'Prototype, refine, and print useful parts, enclosures, fixtures, and classroom models.', 'Fabrication'],
  ['AI readiness sprint', 'from NPR 60,000', 'Map one practical AI workflow, its data needs, human review points, and a small proof of value.', 'Responsible AI'],
  ['Team upskilling', 'from NPR 25,000', 'Hands-on labs that help teams understand automation instead of treating it like a black box.', 'Training'],
]

const activities = [
  ['2610 · 2819 · 2910', 'Electronics, machinery, and motor vehicle-related manufacturing'],
  ['4610 · 4651 · 4652 · 4653 · 4659', 'Wholesale and distribution of computers, electronics, telecom equipment, agricultural machinery, and other equipment'],
  ['4741 · 4742 · 4791', 'Retail of computers, telecom, audio-video equipment, and online products'],
  ['6201 · 6209 · 6311', 'Computer programming, information technology services, hosting, and data processing'],
  ['7110 · 7210 · 7490', 'Engineering, research, experimental development, and professional technical services'],
  ['8522 · 8549', 'Technical, vocational, and other education services'],
]

const proposalSteps = [
  ['01', 'Discover', 'Clarify the client outcome, users, site conditions, classroom count, or product scope.'],
  ['02', 'Shape', 'Select the right hardware, curriculum, software, support, and delivery path.'],
  ['03', 'Cost', 'Separate one-time setup, recurring support, shipping, taxes, and optional upgrades.'],
  ['04', 'Deliver', 'Pilot, test, document, train, and review outcomes before scaling.'],
]

export default function ServicesPage() {
  return <PageShell><PageIntro eyebrow="Services · proposals · delivery" title="A good build creates room to grow." body="Focused web, commerce, AI, IoT, fabrication, robotics, and learning systems for people doing serious work. We start with a useful outcome, not a trend-shaped invoice." /><section className="mx-auto max-w-7xl px-5 py-14 lg:px-8"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{packages.map(([name, price, text, tag]) => <article key={name} className="border-t-2 border-ink bg-white p-6"><p className="text-xs font-black uppercase tracking-widest text-cobalt">{tag}</p><h2 className="mt-10 font-display text-2xl font-bold">{name}</h2><p className="mt-3 text-lg font-bold text-ink">{price}</p><p className="mt-3 leading-7 text-slate-600">{text}</p><a className="mt-8 inline-block text-sm font-black text-cobalt underline decoration-signal decoration-2 underline-offset-4" href="/contact">Talk scope ↗</a></article>)}</div><div className="mt-16 grid gap-8 border-y border-line py-10 lg:grid-cols-[.8fr_1.2fr]"><div><p className="text-xs font-black uppercase tracking-[.24em] text-cobalt">How proposals become real work</p><h2 className="mt-3 font-display text-3xl font-bold">Clear scope before commitment.</h2><p className="mt-4 leading-7 text-slate-600">Client proposals in the company archive use pilots, milestones, explicit deliverables, and payment stages so schools and businesses can approve a practical first step.</p></div><div className="grid gap-4 sm:grid-cols-2">{proposalSteps.map(([number, title, text]) => <div key={number} className="border-l-2 border-signal pl-4"><p className="text-xs font-black text-cobalt">{number} · {title}</p><p className="mt-2 text-sm leading-6 text-slate-600">{text}</p></div>)}</div></div><div className="mt-16 border-y border-line py-10"><p className="text-xs font-black uppercase tracking-[.24em] text-cobalt">Business and client scope</p><h2 className="mt-3 max-w-3xl font-display text-3xl font-bold">Technology, distribution, engineering, and education under one roof.</h2><p className="mt-4 max-w-3xl leading-7 text-slate-600">GENUM can work with schools, NGOs, makerspaces, businesses, and institutional partners. Site-based, regulated, or hardware-dependent work is confirmed case by case after discovery.</p><div className="mt-8 grid gap-x-8 gap-y-6 md:grid-cols-2">{activities.map(([codes, label]) => <div key={codes} className="border-l-2 border-signal pl-4"><p className="text-xs font-black tracking-wide text-cobalt">{codes}</p><p className="mt-1 text-sm font-bold leading-6 text-slate-700">{label}</p></div>)}</div></div><div className="mt-16 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-ink p-7 text-white"><div><p className="text-xs font-black uppercase tracking-[.24em] text-signal">For clients and partners</p><h2 className="mt-2 font-display text-2xl font-bold">Bring a brief, a constraint, or a classroom problem.</h2></div><a href="/contact" className="rounded-full bg-signal px-5 py-3 text-sm font-black text-ink">Request a proposal ↗</a></div></section></PageShell>
}
