import PageIntro from '../../components/PageIntro'
import PageShell from '../../components/PageShell'
import ProductCatalog from '../../components/ProductCatalog'
import { getManagedProducts } from '../../lib/content-store'

export const dynamic = 'force-dynamic'

export default async function ProjectsPage() {
  const products = await getManagedProducts()
  return <PageShell><PageIntro eyebrow="Project catalog · quote by scope" title="Teaching and automation projects, organized." body="The project section contains the named projects from the INVENTORY Excel catalog. Each listing keeps its purpose, operating modes, components, sensors, and indicative NPR estimate together." /><ProductCatalog scope="projects" products={products} /></PageShell>
}
