import type { Metadata } from 'next'
import { Moon } from 'lucide-react'
import PageIntro from '../../components/PageIntro'
import PageShell from '../../components/PageShell'
import IotRemote from '../../components/IotRemote'
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

      {/* App Download Section - single source of truth on website */}
      <div className="mt-12 border-t border-line bg-surface">
        <div className="mx-auto max-w-7xl px-5 py-8 lg:px-8">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-navy">Download GENUM App</p>
              <h2 className="mt-2 font-display text-xl font-bold text-ink">Get the Full Experience</h2>
              <p className="mt-2 text-base leading-relaxed text-muted">
                Download the GENUM mobile app for native Bluetooth control, project packages,
                and robot car builds. Available for Android devices.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <a
                href="/app"
                className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-navy px-6 text-sm font-black text-white transition hover:bg-navy-dark"
              >
                <Moon size={16} aria-hidden="true" /> Download APK
              </a>
              <div className="h-10 w-10 items-center justify-center rounded-full bg-white px-1">
                <p className="text-2xl text-navy">📱</p>
              </div>
            </div>
          </div>
          <div className="mt-4 text-sm text-muted">
            <p>Version 1.4.1 · 29 MB · Android · 64-bit</p>
            <a href="/app" className="underline hover:text-navy">
              View release notes & system requirements
            </a>
          </div>
        </div>
      </div>
    </PageShell>
  )
}