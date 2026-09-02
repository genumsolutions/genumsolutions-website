'use client'

import { useEffect, useState } from 'react'
import { Check, Copy, Download, MonitorSmartphone, Settings2, ShieldCheck, Smartphone } from 'lucide-react'
import PageShell from '../../components/PageShell'
import { androidApp, company, refreshAndroidAppInfo } from '../../lib/company'

const steps = [
  {
    title: 'Download the APK',
    icon: Download,
    body: `Tap "Download" to grab v${androidApp.version} (${androidApp.sizeLabel}, ${androidApp.arch}) — signed by ${company.name}, no app store needed.`,
  },
  {
    title: 'Allow unknown sources',
    icon: Settings2,
    body: 'When your phone asks, allow installation from your browser or from "Unknown sources". You can turn this off again after installing.',
  },
  {
    title: 'Install & open',
    icon: Smartphone,
    body: 'Open the downloaded file, confirm the install, and sign in once. The app remembers your session across tools on the same device.',
  },
]

export default function AppDownloadPage() {
  const [copied, setCopied] = useState(false)
  useEffect(() => { refreshAndroidAppInfo() }, [])

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(androidApp.apkUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard unavailable - ignore */
    }
  }

  return (
    <PageShell>
      <section className="grid-paper border-b border-line">
        <div className="mx-auto max-w-7xl px-5 py-10 sm:py-16 lg:px-8 lg:py-20">
          <p className="text-xs font-black uppercase tracking-[.24em] text-navy">Android app</p>
          <h1 className="mt-3 max-w-2xl font-display text-3xl font-bold leading-[1.1] tracking-[-.04em] text-ink sm:text-4xl lg:text-5xl">
            Get the {company.shortName} app on your phone.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
            Browsing, orders, tools, and device controls — including Robo Car — in one native app for Android.
            v{androidApp.version} · {androidApp.sizeLabel} · {androidApp.arch}.
          </p>
        </div>
      </section>

      <section className="border-b border-line bg-surface">
        <div className="mx-auto max-w-7xl px-5 py-8 lg:px-8">
          <div className="rounded-3xl border border-line bg-white p-6 shadow-sm sm:p-8">
            <div className="grid items-center gap-6 lg:grid-cols-[1.2fr_1fr]">
              <div>
                <h2 className="font-display text-xl font-bold text-ink">Download for Android</h2>
                <p className="mt-2 text-sm leading-6 text-muted">
                  Direct APK download — the fastest way to install. Your phone may warn about unknown sources
                  because the app isn&apos;t on Google Play yet; that&apos;s expected.
                </p>
                <ul className="mt-4 space-y-2 text-sm text-slate-600">
                  <li className="flex items-center gap-2">
                    <ShieldCheck size={16} className="shrink-0 text-navy" aria-hidden="true" /> Signed by {company.name}
                  </li>
                  <li className="flex items-center gap-2">
                    <MonitorSmartphone size={16} className="shrink-0 text-navy" aria-hidden="true" /> Android 64-bit ·{' '}
                    {androidApp.sizeLabel} download
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={16} className="shrink-0 text-navy" aria-hidden="true" /> Install over an older version to
                    keep your data
                  </li>
                </ul>
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <a
                    href={androidApp.apkUrl}
                    download
                    className="inline-flex h-12 items-center gap-2 rounded-full bg-navy px-6 text-sm font-black text-white shadow-sm transition hover:bg-navy-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
                  >
                    <Download size={16} aria-hidden="true" />
                    Download v{androidApp.version}
                  </a>
                  <button
                    type="button"
                    onClick={copyLink}
                    className="inline-flex h-12 items-center gap-2 rounded-full border border-line bg-white px-5 text-sm font-bold text-ink transition hover:border-navy hover:text-navy focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
                  >
                    {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
                    {copied ? 'Link copied' : 'Copy direct link'}
                  </button>
                </div>
              </div>

              <div className="hidden justify-center lg:flex" aria-hidden="true">
                <div className="flex h-40 w-40 items-center justify-center rounded-[2.2rem] bg-gradient-to-br from-navy to-navy-dark shadow-xl ring-1 ring-navy/20">
                  <Smartphone size={56} className="text-white" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-line">
        <div className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
          <h2 className="text-xs font-black uppercase tracking-[.24em] text-navy">Three quick steps</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {steps.map((step, i) => (
              <div key={step.title} className="rounded-2xl border border-line bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <step.icon size={20} className="text-navy" aria-hidden="true" />
                  <span className="text-3xl font-black text-mist/80">{i + 1}</span>
                </div>
                <h3 className="mt-4 font-display text-base font-bold text-ink">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted">{step.body}</p>
              </div>
            ))}
          </div>

          <p className="mt-8 text-sm leading-6 text-muted">
            Need a hand? Contact us at{' '}
            <a href={`mailto:${company.email}`} className="font-bold text-navy hover:underline">
              {company.email}
            </a>{' '}
            or call{' '}
            <a href={`tel:${company.phone.replace(/\s/g, '')}`} className="font-bold text-navy hover:underline">
              {company.phone}
            </a>
            . Release notes and version history are in the{' '}
            <a href={androidApp.releaseUrl} className="font-bold text-navy hover:underline">
              release manifest
            </a>
            .
          </p>
        </div>
      </section>
    </PageShell>
  )
}
