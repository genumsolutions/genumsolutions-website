import type { Metadata } from 'next'
import { Manrope, Space_Grotesk } from 'next/font/google'
import OrganizationJsonLd from '../components/OrganizationJsonLd'
import { CartProvider } from '../components/cart-provider'
import PageViewTracker from '../components/PageViewTracker'
import { company } from '../lib/company'
import './globals.css'

const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope' })
const space = Space_Grotesk({ subsets: ['latin'], variable: '--font-space' })

export const metadata: Metadata = {
  metadataBase: new URL(company.url),
  title: { default: 'GENUM SOLUTIONS | Build what matters', template: '%s | GENUM SOLUTIONS' },
  description: company.description,
  applicationName: company.shortName,
  keywords: ['robotics Nepal', 'electronics Kathmandu', '3D printing Nepal', 'IoT training Nepal', 'AI prototyping Nepal', 'DIY robotics kits'],
  authors: [{ name: company.name }],
  creator: company.name,
  publisher: company.name,
  alternates: { canonical: '/' },
  openGraph: { type: 'website', locale: 'en_NP', url: '/', siteName: company.shortName, title: 'GENUM SOLUTIONS | Build what matters', description: company.description, images: [{ url: '/logo.png', width: 512, height: 512, alt: 'GENUM SOLUTIONS official stamp' }] },
  twitter: { card: 'summary', title: 'GENUM SOLUTIONS | Build what matters', description: company.description, images: ['/logo.png'] },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large' } },
  icons: { icon: '/logo.png', apple: '/logo.png' },
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem('theme');if(t==='dim')document.documentElement.setAttribute('data-theme','dim')}catch(e){}` }} />
      </head>
      <body className={`${manrope.variable} ${space.variable}`}>
        <OrganizationJsonLd />
        <PageViewTracker />
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  )
}
