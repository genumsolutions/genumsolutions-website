import type { Metadata } from 'next'
import PageShell from '../../components/PageShell'
import CategoryPage from '../../components/CategoryPage'

export const metadata: Metadata = {
  title: 'Home Automation',
  description: 'Home automation projects with ESP32, ESP8266 and Arduino: relay control, sensors, schedules, and remote control.',
}

export default function HomeAutomationPage() {
  return (
    <PageShell>
      <CategoryPage slug="home-automation" />
    </PageShell>
  )
}
