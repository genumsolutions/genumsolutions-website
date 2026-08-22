import PageIntro from '../../components/PageIntro'
import PageShell from '../../components/PageShell'
import ProductCatalog from '../../components/ProductCatalog'
import { getManagedProducts } from '../../lib/content-store'

export const dynamic = 'force-dynamic'

export default async function ProductsPage() {
	const products = await getManagedProducts()
	return <PageShell>
		<PageIntro eyebrow="Components and materials" title="Choose the part, then build." body="Browse controllers, motors, sensors, communication modules, displays, power, mechanical parts, connectors, and tools. Assembled cars, project packages, and 3D printing have their own sections." />
		<ProductCatalog scope="components" products={products} />
	</PageShell>
}
