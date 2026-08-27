import { company } from '../lib/company'

export default function WebSiteJsonLd() {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: company.name,
    alternateName: company.shortName,
    description: company.description,
    url: company.url,
    publisher: {
      '@type': 'Organization',
      name: company.name,
      url: company.url,
      logo: `${company.url}/logo.png`,
    },
    inLanguage: 'en-NP',
  }

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
}