import type { Metadata } from 'next'
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
  return <PageShell><PageIntro eyebrow="Projects · packages &amp; robot cars" title="Teaching, automation, and robot-car projects." body="Browse project packages and assembled robot-car builds. Each listing keeps its purpose, components, sensors, and indicative NPR estimate together." /><ProjectsCatalog products={products} /></PageShell>
}
