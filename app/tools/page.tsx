import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Gamepad2 } from 'lucide-react'
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
      {/* IoT & Remote Controller section - separate from third-party tools */}
      <section className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-7xl flex-col items-start gap-4 px-5 py-6 sm:flex-row sm:items-center lg:px-8">
          <div className="max-w-xl">
            <p className="text-xs font-black uppercase tracking-widest text-navy">IoT & Remote Controller</p>
            <p className="mt-1 text-sm leading-6 text-muted">
              Test and control your devices — robot cars, home automation, smart farm,
              smart city, and drones — over Bluetooth or WiFi on one page.
            </p>
          </div>
          <Link
            href="/iot-remote"
            className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-navy px-6 text-sm font-black text-white transition hover:bg-navy-dark"
          >
            <Gamepad2 size={16} aria-hidden="true" />
            IoT & Remote Controller
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </section>

      {/* OpenTools - third-party tools */}
      <OpenTools />
    </PageShell>
  )
}