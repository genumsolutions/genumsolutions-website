import PageIntro from '../../components/PageIntro'
import PageShell from '../../components/PageShell'
import ProductCatalog from '../../components/ProductCatalog'

export default function ProjectsPage() {
  return <PageShell><PageIntro eyebrow="Project catalog · quote by scope" title="Teaching and automation projects, organized." body="The project section contains the named projects from the INVENTORY Excel catalog. Each listing keeps its purpose, operating modes, components, sensors, and indicative NPR estimate together." /><ProductCatalog scope="projects" /></PageShell>
}
