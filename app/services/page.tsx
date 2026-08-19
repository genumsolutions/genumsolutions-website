import PageIntro from '../../components/PageIntro'
import PageShell from '../../components/PageShell'

const packages = [
	{ name: 'Web presence', price: 'from NPR 35,000', text: 'A sharp, fast web presence for a business ready to be found.', tag: 'Static' },
	{ name: 'Content system', price: 'from NPR 75,000', text: 'A flexible CMS your team can update without a developer.', tag: 'CMS' },
	{ name: 'Commerce engine', price: 'from NPR 125,000', text: 'A storefront with catalog, payments, order workflows, and analytics.', tag: 'E-commerce' },
	{ name: 'IoT prototype', price: 'from NPR 95,000', text: 'Connect sensors to a useful dashboard with data quality and handoff in mind.', tag: 'AI + IoT' },
	{ name: '3D print studio', price: 'from NPR 2,500', text: 'Prototype, refine, and print useful parts, enclosures, fixtures, and classroom models.', tag: '3D Printing' },
	{ name: 'AI readiness sprint', price: 'from NPR 60,000', text: 'Map one practical AI workflow, its data needs, human review points, and a small proof of value.', tag: 'Responsible AI' },
	{ name: 'Team upskilling', price: 'from NPR 25,000', text: 'Hands-on labs that help teams understand automation instead of treating it like a black box.', tag: 'Training' },
]

export default function ServicesPage() {
	return <PageShell><PageIntro eyebrow="Services · 2026 focus" title="A good build creates room to grow." body="Focused web, commerce, AI, IoT, and learning systems for people doing serious work. We start with a useful outcome, not a trend-shaped invoice." /><section className="mx-auto grid max-w-7xl gap-4 px-5 py-14 sm:grid-cols-2 lg:grid-cols-3 lg:px-8">{packages.map((item) => <article key={item.name} className="border-t-2 border-ink bg-white p-6"><p className="text-xs font-black uppercase tracking-widest text-cobalt">{item.tag}</p><h2 className="mt-10 font-display text-2xl font-bold">{item.name}</h2><p className="mt-3 text-lg font-bold text-ink">{item.price}</p><p className="mt-3 leading-7 text-slate-600">{item.text}</p><a className="mt-8 inline-block text-sm font-black text-cobalt underline decoration-signal decoration-2 underline-offset-4" href="/contact">Talk scope ↗</a></article>)}</section><section className="mx-auto max-w-7xl px-5 pb-16 lg:px-8"><div className="border-y border-line py-8"><p className="text-xs font-black uppercase tracking-[.24em] text-cobalt">What informed this menu</p><p className="mt-4 max-w-3xl leading-7 text-slate-600">The World Economic Forum’s Future of Jobs 2025 report identifies technology change, AI and information processing, robotics, networks, and skills gaps as major forces through 2030. GENUM turns those signals into small, understandable projects with a human in the loop.</p><div className="mt-4 flex flex-wrap gap-4 text-xs font-bold"><a className="text-cobalt underline underline-offset-4" href="https://www.weforum.org/publications/the-future-of-jobs-report-2025/">Read WEF 2025 ↗</a><a className="text-cobalt underline underline-offset-4" href="https://ifr.org/ifr-press-releases/news/world-robotics-2025-report-asia-leads-global-robotics-growth">Read IFR robotics research ↗</a></div></div></section></PageShell>
}
