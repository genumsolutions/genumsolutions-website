import { notFound } from 'next/navigation'
import ProductDetailPro from '../../../components/ProductDetailPro'
import PageShell from '../../../components/PageShell'
import { findProduct, products } from '../../../lib/catalog'

export function generateStaticParams() {
  return products.map((product) => ({ slug: product.id }))
}

export default function ProductPage({ params }: { params: { slug: string } }) {
  const product = findProduct(params.slug)
  if (!product) notFound()
  return <PageShell><ProductDetailPro product={product} /></PageShell>
}
