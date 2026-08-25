import { company } from '../lib/company'

export default function OrganizationJsonLd() {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: company.name,
    url: company.url,
    logo: `${company.url}/logo.png`,
    description: company.description,
    email: company.email,
    telephone: company.phone,
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Shringhkhala Galli-32',
      addressLocality: company.city,
      addressCountry: company.country,
    },
    areaServed: 'Nepal',
  }

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
}
