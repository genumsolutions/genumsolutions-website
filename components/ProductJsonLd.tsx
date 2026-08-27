import { company } from '../lib/company'
import type { Product } from '../lib/catalog'

export default function ProductJsonLd({ product }: { product: Product }) {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    brand: { '@type': 'Brand', name: company.name },
    description: product.note || product.description,
    image: product.image ? `${company.url}${product.image}` : undefined,
    sku: product.sku,
    offers: {
      '@type': 'Offer',
      priceCurrency: 'NPR',
      price: product.price,
      availability: product.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      url: `${company.url}/products/${product.id}`,
    },
  }

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
}