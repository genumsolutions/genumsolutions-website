import type { Metadata, Viewport } from 'next'
import { Inter, Sora } from 'next/font/google'
import OrganizationJsonLd from '../components/OrganizationJsonLd'
import WebSiteJsonLd from '../components/WebSiteJsonLd'
import { CartProvider } from '../components/cart-provider'
import PageViewTracker from '../components/PageViewTracker'
import ServiceWorkerRegister from '../components/ServiceWorkerRegister'
import WebVitals from '../components/WebVitals'
import { getCompany } from '../lib/company-store'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const sora = Sora({ subsets: ['latin'], variable: '--font-sora' })

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
}

// Company info shown in the layout metadata / shared footer is read DB-first
// (company-store, cached). This segment default lets statically-rendered pages
// revalidate in the background so an edit in the company_info table appears
// site-wide within ~5 minutes without a redeploy. Force-dynamic pages override.
export const revalidate = 300

export async function generateMetadata(): Promise<Metadata> {
  const company = await getCompany()
  return {
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
    icons: {
      icon: [
        { url: '/icon-32.png', sizes: '32x32', type: 'image/png' },
        { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      ],
      apple: '/apple-touch-icon.png',
    },
  }
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const company = await getCompany()
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#1e3a8a" />
        <script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem('genum-theme');if(t==='dim')document.documentElement.setAttribute('data-theme','dim')}catch(e){}` }} />
      </head>
      <body className={`${inter.variable} ${sora.variable}`}>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-navy focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-white"
        >
          Skip to content
        </a>
        <OrganizationJsonLd company={company} />
        <WebSiteJsonLd company={company} />
        <PageViewTracker />
        <WebVitals />
        <ServiceWorkerRegister />
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  )
}
