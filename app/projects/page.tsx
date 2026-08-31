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
      <PageIntro eyebrow="Projects · packages & robot cars" title="Teaching, automation, and robot-car projects." body="Browse project packages and assembled robot-car builds, with components, sensors, and pricing together." />
      <div className="mx-auto max-w-7xl px-5 pb-2 lg:px-8">
        <Link href="/tools" className="inline-flex items-center gap-2 rounded-full bg-navy px-5 py-2.5 text-sm font-black text-white transition hover:bg-navy-dark">
          Test & control on the IoT Controller
          <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </div>
<ProjectsCatalog products={products} />
    </PageShell>
  )
}