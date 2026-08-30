import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Moon } from 'lucide-react'
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
      {/* Download App Section - single source of truth on website */}
      <div className="mt-12 border-t border-line bg-surface">
        <div className="mx-auto max-w-7xl px-5 py-8 lg:px-8">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-navy">Download GENUM App</p>
              <h2 className="mt-2 font-display text-xl font-bold text-ink">Get the Full Experience</h2>
              <p className="mt-2 text-base leading-relaxed text-muted">
                Download the GENUM mobile app for native Bluetooth control, project packages,
                and robot car builds. Available for Android devices.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <a
                href="/app"
                className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-navy px-6 text-sm font-black text-white transition hover:bg-navy-dark"
              >
                <Moon size={16} aria-hidden="true" /> Download APK
              </a>
              <div className="h-10 w-10 items-center justify-center rounded-full bg-white px-1">
<p className="text-2xl text-navy">📱</p>
</div>
            </div>
          </div>
          <div className="mt-4 text-sm text-muted">
            <p>Version 1.4.1 · 29 MB · Android · 64-bit</p>
            <a href="/app" className="underline hover:text-navy">
              View release notes & system requirements
            </a>
          </div>
        </div>
      </div>
    </PageShell>
  )
}