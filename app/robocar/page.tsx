import type { Metadata } from 'next'
import PageShell from '../../components/PageShell'
import RoboCarControl from '../../components/RoboCarControl'

export const metadata: Metadata = {
  title: 'Robo Car Control',
  description: 'Connect and control GENUM robot cars: 4WD Bluetooth, 2WD+servo, self-balancing, obstacle avoidance, path following, website, and RF cars.',
}

export default function RoboCarPage() {
  return (
    <PageShell>
      <RoboCarControl />
    </PageShell>
  )
}
