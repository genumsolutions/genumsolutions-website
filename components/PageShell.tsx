import SiteFooter from './SiteFooter'
import SiteHeader from './SiteHeader'

export default function PageShell({ children }: { children: React.ReactNode }) {
  return <><SiteHeader />{children}<SiteFooter /></>
}
