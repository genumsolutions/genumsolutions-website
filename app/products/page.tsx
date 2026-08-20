import PageIntro from '../../components/PageIntro'
import PageShell from '../../components/PageShell'
import ProductCatalog from '../../components/ProductCatalog'

export default function ProductsPage() {
	return <PageShell>
		<PageIntro eyebrow="Components and materials" title="Choose the part, then build." body="Browse controllers, motors, sensors, communication modules, displays, power, mechanical parts, connectors, and tools. Assembled cars, project packages, and 3D printing have their own sections." />
		<ProductCatalog scope="components" />
	</PageShell>
}
