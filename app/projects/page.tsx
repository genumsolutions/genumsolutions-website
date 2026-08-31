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

export default async function ProjectsPage() {
  const products = await getManagedProducts()
  return (
    <PageShell>
      <PageIntro eyebrow="Projects · packages & robot cars" title="Teaching, automation, and robot-car projects." body="Browse project packages and assembled robot-car projects. Each listing keeps its purpose, components, sensors, and indicative NPR estimate together." />
      <section className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-7xl flex-col items-start gap-4 px-5 py-6 sm:flex-row sm:items-center lg:px-8">
          <div className="max-w-xl">
            <p className="text-xs font-black uppercase tracking-widest text-navy">Test & control</p>
            <p className="mt-1 text-sm leading-6 text-muted">
              Driving and live device control live on the IoT & Remote Controller page.
              This page is the catalogue of project descriptions and builds. Packages with
              < code className="font-mono text-xs text-navy">robot</code>, < code className="font-mono text-xs text-navy">car</code>, or < code className="font-mono text-xs text-navy">IoT</code> in their description can be controlled via the IoT & Remote Controller page.
            </p>
          </div>
          <Link
            href="/tools"
            className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-navy px-6 text-sm font-black text-white transition hover:bg-navy-dark"
          >
            Open IoT & Remote Controller
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </section>
<ProjectsCatalog products={products} />
    </PageShell>
  )
}