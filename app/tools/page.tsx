import type { Metadata } from 'next'
import PageIntro from '../../components/PageIntro'
import PageShell from '../../components/PageShell'
import OpenTools from '../../components/OpenTools'

export const metadata: Metadata = {
  title: 'Tools',
  description: 'Free and open-source tools for designing, simulating, programming, and documenting robotics and fabrication work.',
}

export default function ToolsPage() {
  return (
    <PageShell>
      <PageIntro
        eyebrow="Tools · open source"
        title="Useful tools for the next build."
        body="A small, practical directory for designing, simulating, programming, and documenting robotics and fabrication work."
      />
      <OpenTools />
    </PageShell>
  )
}
