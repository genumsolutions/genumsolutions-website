import PageIntro from '../../components/PageIntro'
import PageShell from '../../components/PageShell'
import ProductCatalog from '../../components/ProductCatalog'
import { getManagedProducts } from '../../lib/content-store'

export const dynamic = 'force-dynamic'

export default async function RobotCarsPage() {
  const products = await getManagedProducts()
  return <PageShell><PageIntro eyebrow="Robot Cars · assembled projects" title="Three builds, three reasons to choose them." body="These assembled robot-car projects are separated from components and materials. Near-duplicate Arduino versions are consolidated into one canonical build; each remaining car has a different control or teaching purpose." /><ProductCatalog scope="cars" products={products} /></PageShell>
}
