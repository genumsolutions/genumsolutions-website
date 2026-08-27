import type { Metadata, Viewport } from 'next'
import { Inter, Sora } from 'next/font/google'
import OrganizationJsonLd from '../components/OrganizationJsonLd'
import { CartProvider } from '../components/cart-provider'
import PageViewTracker from '../components/PageViewTracker'
import WebVitals from '../components/WebVitals'
import { company } from '../lib/company'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const sora = Sora({ subsets: ['latin'], variable: '--font-sora' })

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
}

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
  icons: {
    icon: [
      { url: '/icon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#1e3a8a" />
        <script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem('theme');if(t==='dim')document.documentElement.setAttribute('data-theme','dim')}catch(e){}` }} />
      </head>
      <body className={`${inter.variable} ${sora.variable}`}>
        <OrganizationJsonLd />
        <PageViewTracker />
        <WebVitals />
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  )
}
