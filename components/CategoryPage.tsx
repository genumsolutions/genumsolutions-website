import Link from 'next/link'
import { getProjectCategory } from '../lib/project-catalog'

const CAPABILITY_NOTES: Record<string, string> = {
  directional: 'Drive forward, back, left, and right with adjustable speed',
  servo: 'Steer with a servo and tune the endpoint angles',
  pid: 'Tune the PID and read the live angle/heading',
  'start-stop': 'Run and stop autonomous behaviour with a toggle',
  relay: 'Flip relay / switch outputs (AC and DC loads)',
  sensor: 'Read live sensor values from the device',
  weblink: 'Link a client/server ESP connection over WiFi',
  slider: 'Adjust an arbitrary 0..n value (speed, threshold, brightness)',
}

function buildPoints(category: ReturnType<typeof getProjectCategory>): string[] {
  if (!category) return []
  const capPoints = (category.capabilities ?? []).map(
    (cap) => CAPABILITY_NOTES[cap] ?? `Control via ${cap}`,
  )
  return [category.tagline, ...capPoints].filter(Boolean)
}

export default function CategoryPage({ slug }: { slug: string }) {
  const cat = getProjectCategory(slug)

  if (!cat) return null

  const points = buildPoints(cat)

  return (
    <div className="mx-auto max-w-7xl px-5 py-10 lg:px-8 lg:py-12">
      <p className="text-[10px] font-black uppercase tracking-widest text-navy">{cat.name}</p>
      <h1 className="mt-2 font-display text-3xl font-bold text-ink lg:text-5xl">{cat.name}</h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-muted lg:text-lg">{cat.description}</p>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-line bg-white p-6 shadow-card">
          <h2 className="font-display text-lg font-bold text-ink">What you can build</h2>
          <ul className="mt-4 space-y-3">
            {points.map((point) => (
              <li key={point} className="flex items-start gap-2 text-sm leading-6 text-muted">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                {point}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-line bg-white p-6 shadow-card">
          <h2 className="font-display text-lg font-bold text-ink">Typical hardware</h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {cat.hardware.map((item) => (
              <li key={item} className="whitespace-nowrap rounded-full bg-mist px-3 py-1.5 text-xs font-bold text-navy">
                {item}
              </li>
            ))}
          </ul>
          <div className="mt-6 rounded-xl bg-sky px-4 py-3">
            <Link href="/tools">
              <p className="text-sm font-bold text-navy hover:underline">Test & control this category &rarr;</p>
            </Link>
            <p className="mt-1 text-xs leading-5 text-muted">
              Live controls for this category live on the Tools page
              and use the same Bluetooth / WiFi transport as the robot cars.
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}
