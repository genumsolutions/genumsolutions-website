import type { MetadataRoute } from 'next'
import { company } from '../lib/company'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/admin/', '/account', '/account/', '/login', '/api/', '/checkout', '/checkout/', '/auth/'],
    },
    sitemap: `${company.url}/sitemap.xml`,
  }
}
