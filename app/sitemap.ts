import type { MetadataRoute } from 'next'
import { company } from '../lib/company'
import { products } from '../lib/catalog'

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ['', '/about', '/services', '/products', '/robot-cars', '/projects', '/3d-printing', '/training', '/journal', '/tools', '/contact', '/checkout']
  return [...pages.map((path) => ({ url: `${company.url}${path}`, lastModified: new Date(), changeFrequency: 'weekly' as const, priority: path === '' ? 1 : 0.7 })), ...products.map((product) => ({ url: `${company.url}/products/${product.id}`, lastModified: new Date(), changeFrequency: 'weekly' as const, priority: 0.6 }))]
}
