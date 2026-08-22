import { notFound } from 'next/navigation'
import ProductDetailPro from '../../../components/ProductDetailPro'
import PageShell from '../../../components/PageShell'
import { getManagedProducts } from '../../../lib/content-store'

export function generateStaticParams() {
  return []
}

export const dynamic = 'force-dynamic'

export default async function ProductPage({ params }: { params: { slug: string } }) {
  const product = (await getManagedProducts()).find((item) => item.id === params.slug)
  if (!product) notFound()
  return <PageShell><ProductDetailPro product={product} /></PageShell>
}
