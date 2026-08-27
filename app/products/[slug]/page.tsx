import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import ProductDetailPro from '../../../components/ProductDetailPro'
import ProductJsonLd from '../../../components/ProductJsonLd'
import PageShell from '../../../components/PageShell'
import { getManagedProducts } from '../../../lib/content-store'

export function generateStaticParams() {
  return []
}

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const product = (await getManagedProducts()).find((item) => item.id === params.slug)
  if (!product) return {}
  const description = (product.note || product.description || '').slice(0, 155)
  return {
    title: product.name,
    description,
    alternates: { canonical: `/products/${product.id}` },
    openGraph: {
      title: product.name,
      description,
      url: `/products/${product.id}`,
      images: product.image ? [{ url: product.image, alt: product.name }] : undefined,
    },
  }
}

export default async function ProductPage({ params }: { params: { slug: string } }) {
  const product = (await getManagedProducts()).find((item) => item.id === params.slug)
  if (!product) notFound()
  return (
    <>
      <ProductJsonLd product={product} />
      <PageShell><ProductDetailPro product={product} /></PageShell>
    </>
  )
}
