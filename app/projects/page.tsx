import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import PageIntro from '../../components/PageIntro'
import PageShell from '../../components/PageShell'
import ProjectsCatalog from '../../components/ProjectsCatalog'
import { getManagedProducts } from '../../lib/content-store'

export const metadata: Metadata = {
  title: 'Projects',
  description: 'Project packages and robot-car builds for teaching, automation, and prototyping from GENUM Solutions.',
}

export const dynamic = 'force-dynamic'

const CATEGORY_LINKS = [
  { label: 'Robot Car', href: '/robocar', blurb: 'Drive & tune the robot cars (BLE / WiFi)' },
  { label: 'Home Automation', href: '/home-automation', blurb: 'Relays, sensors & smart controls' },
  { label: 'Smart Farm', href: '/smart-farm', blurb: 'Irrigation, soil & pump automation' },
  { label: 'Smart City', href: '/smart-city', blurb: 'Lighting, parking & monitoring' },
  { label: 'Drones', href: '/drones', blurb: 'Flight controllers & telemetry' },
]

export default async function ProjectsPage() {
  const products = await getManagedProducts()
  return (
    <PageShell>
      <PageIntro eyebrow="Projects · packages &amp; robot cars" title="Teaching, automation, and robot-car projects." body="Browse project packages and assembled robot-car builds. Each listing keeps its purpose, components, sensors, and indicative NPR estimate together." />
      <section className="border-b border-line bg-surface">
        <div className="mx-auto max-w-7xl px-5 py-6 lg:px-8">
          <p className="text-xs font-black uppercase tracking-widest text-navy">Project categories</p>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {CATEGORY_LINKS.map((cat) => (
              <li key={cat.href}>
                <Link
                  href={cat.href}
                  className="group flex h-full flex-col justify-between rounded-2xl border border-line bg-white p-4 shadow-sm transition hover:border-navy hover:shadow-md"
                >
                  <span className="flex items-center justify-between">
                    <span className="text-sm font-bold text-ink">{cat.label}</span>
                    <ArrowRight size={15} className="text-navy transition group-hover:translate-x-0.5" />
                  </span>
                  <span className="mt-2 text-xs leading-5 text-muted">{cat.blurb}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
      <ProjectsCatalog products={products} />
    </PageShell>
  )
}
