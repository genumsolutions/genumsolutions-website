import type { Metadata } from 'next'
import PageShell from '../../components/PageShell'
import CategoryPage from '../../components/CategoryPage'

export const metadata: Metadata = {
  title: 'Drones & Aerial',
  description: 'Drone and aerial robotics projects: flight controllers, telemetry, and ground-station control with ESP and Arduino.',
}

export default function DronesPage() {
  return (
    <PageShell>
      <CategoryPage slug="drones" />
    </PageShell>
  )
}
