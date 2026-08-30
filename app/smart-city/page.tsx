import type { Metadata } from 'next'
import PageShell from '../../components/PageShell'
import CategoryPage from '../../components/CategoryPage'

export const metadata: Metadata = {
  title: 'Smart City',
  description: 'Smart city projects with ESP and Arduino: street lighting, parking, environment monitoring, and central control.',
}

export default function SmartCityPage() {
  return (
    <PageShell>
      <CategoryPage slug="smart-city" />
    </PageShell>
  )
}
