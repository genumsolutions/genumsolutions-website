import type { ReactNode } from 'react'
import SiteFooter from './SiteFooter'
import SiteHeader from './SiteHeader'

// NOTE: AppBanner is rendered in the root layout (layout.tsx) to avoid
// duplicate banners. Do NOT add it back here.

export default function PageShell({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main id="main-content">{children}</main>
      <SiteFooter />
    </>
  )
}
