import type { Metadata } from 'next'
import BreadcrumbListJsonLd from '../../components/BreadcrumbListJsonLd'
import PageIntro from '../../components/PageIntro'
import PageShell from '../../components/PageShell'
import ProductCatalog from '../../components/ProductCatalog'
import { getManagedProducts } from '../../lib/content-store'

export const metadata: Metadata = {
  title: 'Products',
  description: 'Robotics kits, controllers, sensors, motors, and electronics — sourced, tested, and ready to build with.',
}

export const dynamic = 'force-dynamic'

export default async function ProductsPage() {
	const products = await getManagedProducts()
	return <PageShell>
		<BreadcrumbListJsonLd items={[{ name: 'Home', path: '/' }, { name: 'Products', path: '/products' }]} />
		<PageIntro eyebrow="Components and materials" title="Choose the part, then build." body="Browse controllers, motors, sensors, communication modules, displays, power, mechanical parts, connectors, and tools. Assembled cars, project packages, and 3D printing have their own sections." />
		<ProductCatalog scope="components" products={products} />
	</PageShell>
}
