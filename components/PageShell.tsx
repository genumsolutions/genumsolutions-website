import type { ReactNode } from 'react'
import SiteFooter from './SiteFooter'
import SiteHeader from './SiteHeader'

export default function PageShell({ children }: { children: ReactNode }) {
  return (
    <>
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:m-2 focus:rounded-lg focus:bg-cobalt focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-white">
        Skip to content
      </a>
      <SiteHeader />
      <main id="main-content">{children}</main>
      <SiteFooter />
    </>
  )
}
