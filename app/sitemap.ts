import type { MetadataRoute } from 'next'
import { company } from '../lib/company'
import { getManagedProducts } from '../lib/content-store'

// Reads live products so DB changes are reflected on refresh.
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = await getManagedProducts()
  const pages = ['', '/about', '/services', '/products', '/robot-cars', '/projects', '/3d-printing', '/training', '/journal', '/tools', '/contact', '/checkout']
  return [...pages.map((path) => ({ url: `${company.url}${path}`, lastModified: new Date(), changeFrequency: 'weekly' as const, priority: path === '' ? 1 : 0.7 })), ...products.map((product) => ({ url: `${company.url}/products/${product.id}`, lastModified: new Date(), changeFrequency: 'weekly' as const, priority: 0.6 }))]
}
