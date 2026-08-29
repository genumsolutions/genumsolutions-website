import Image from 'next/image'
import { ArrowRight, CheckCircle2, Download, ShieldCheck, Smartphone } from 'lucide-react'
import { company } from '../lib/company'

const APK_URL = 'https://bkylfnlybtsujwzropru.supabase.co/storage/v1/object/public/app-releases/genum-solutions-latest.apk'
const APK_VERSION = '1.0.0'
const APK_SIZE = '23.9 MB'
// Almost all modern Android phones are arm64 (64-bit).
const APK_ARCH = '64-bit (arm64)'

const installSteps = [
  'Tap the "Get the app" button to download the APK file.',
  'When the download finishes, open it from your notifications or Downloads folder.',
  "If Android asks about installing from this browser/source, allow it once.",
  'Open GENUM and sign in — browsing, tools, and device controls are ready.',
]

const features = [
  'The full website on your phone — orders, account, and contact included',
  'Offline-cached browsing: pages you have visited stay available without data',
  'Device controls panel for BLE and IoT hardware',
  'Signed and verified by GENUM Solutions Pvt. Ltd.',
]

export default function AppDownload() {
  return (
    <section id="app" aria-labelledby="app-heading" className="border-y border-line bg-mist py-12 lg:py-20">
      <div className="mx-auto grid max-w-7xl items-center gap-8 px-5 lg:grid-cols-[.9fr_1.1fr] lg:gap-14 lg:px-8">
        <div>
          <p className="text-xs font-black uppercase tracking-[.24em] text-navy">Mobile app</p>
          <h2 id="app-heading" className="mt-2 font-display text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
            Take GENUM with you.
          </h2>
          <p className="mt-4 max-w-xl leading-7 text-slate-600">
            One app for browsing the catalog, managing your account, using the open tools, and
            controlling your IoT hardware — with recently viewed pages cached so they keep working
            even with no signal.
          </p>

          <ul className="mt-6 space-y-2.5">
            {features.map((feature) => (
              <li key={feature} className="flex gap-2.5 text-sm leading-6 text-slate-600">
                <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden="true" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href={APK_URL}
              className="inline-flex h-12 items-center gap-2 rounded-full bg-navy px-6 text-sm font-black text-white shadow-sm transition hover:bg-navy-dark hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
            >
              <Download size={16} aria-hidden="true" /> Get the app
            </a>
            <a
              href="/contact"
              className="inline-flex h-12 items-center gap-2 rounded-full border border-line bg-white px-6 text-sm font-black text-ink transition hover:border-navy hover:text-navy focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
            >
              Request help <ArrowRight size={15} aria-hidden="true" />
            </a>
          </div>

          <p className="mt-4 text-xs leading-5 text-slate-500">
            <strong className="text-ink">Version {APK_VERSION}</strong> · {APK_SIZE} · Android, {APK_ARCH}. Direct APK hosted by
            GENUM — no app store needed.
          </p>
        </div>

        <div className="mx-auto w-full max-w-md rounded-3xl border border-line bg-white p-6 shadow-card sm:p-8">
          <div className="flex items-center gap-4">
            <span className="relative block h-14 w-14 shrink-0 overflow-hidden rounded-full bg-white ring-1 ring-line">
              <Image src="/logo.png" alt="GENUM SOLUTIONS app icon" width={112} height={112} className="h-full w-full object-contain" />
            </span>
            <div>
              <p className="font-display text-lg font-bold text-ink">{company.shortName} app</p>
              <p className="text-xs text-slate-500">v{APK_VERSION} · {APK_SIZE} · {APK_ARCH}</p>
            </div>
          </div>

          <ol className="mt-6 space-y-3">
            {installSteps.map((step, index) => (
              <li key={step} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky text-xs font-black text-navy">
                  {index + 1}
                </span>
                <p className="pt-0.5 text-sm leading-6 text-slate-600">{step}</p>
              </li>
            ))}
          </ol>

          <div className="mt-6 flex items-center gap-2 rounded-xl bg-sky px-4 py-3">
            <ShieldCheck size={16} className="shrink-0 text-navy" aria-hidden="true" />
            <p className="text-xs leading-5 text-slate-600">
              <strong className="text-navy">Signed by {company.name}.</strong> The APK authenticates to our release certificate —
              verify before installing if you have concerns.
            </p>
          </div>

          <a
            href={APK_URL}
            className="mt-6 flex h-12 items-center justify-center gap-2 rounded-full bg-gold px-6 text-sm font-black text-white transition hover:bg-gold-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          >
            <Download size={16} aria-hidden="true" /> Download {APK_VERSION} ({APK_SIZE})
          </a>
          <p className="mt-2 flex items-center justify-center gap-1.5 text-center text-xs text-slate-500">
            <Smartphone size={13} aria-hidden="true" /> Works on Android 8 and newer
          </p>
        </div>
      </div>
    </section>
  )
}