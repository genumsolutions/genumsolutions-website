import type { Metadata } from 'next'
import PageShell from '../../components/PageShell'
import CategoryPage from '../../components/CategoryPage'

export const metadata: Metadata = {
  title: 'Smart Farm',
  description: 'Smart farm automation with ESP and Arduino: irrigation, soil monitoring, pump control, and telemetry.',
}

export default function SmartFarmPage() {
  return (
    <PageShell>
      <CategoryPage slug="smart-farm" />
    </PageShell>
  )
}
