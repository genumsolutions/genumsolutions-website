import PageIntro from '../../components/PageIntro'
import PageShell from '../../components/PageShell'
import ProductCatalog from '../../components/ProductCatalog'

export default function ProductsPage() {
	return <PageShell>
		<PageIntro eyebrow="The shop" title="Tools for curious hands." body="Small-batch kits, reliable components, and guided experiments for your next working idea." />
		<ProductCatalog />
	</PageShell>
}
