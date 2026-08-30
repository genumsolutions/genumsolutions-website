import type { Metadata } from 'next'
import { Gamepad2 } from 'lucide-react'
import PageIntro from '../../components/PageIntro'
import PageShell from '../../components/PageShell'
import IotRemote from '../../app/iot-remote/page'
import OpenTools from '../../components/OpenTools'

export const metadata: Metadata = {
  title: 'Tools',
  description:
    'Free and open-source tools for designing, simulating, programming, and documenting robotics and fabrication work. Includes IoT & Remote Controller.',
}

export default function ToolsPage() {
  return (
    <PageShell>
      <PageIntro
        eyebrow="Tools · open source"
        title="Useful tools for the next build."
        body="A small, practical directory for designing, simulating, programming, and documenting robotics and fabrication work."
      />
      {/* IoT & Remote Controller section - embedded in tools page */}
      <IotRemote />

      {/* OpenTools - third-party tools */}
      <OpenTools />
    </PageShell>
  )
}