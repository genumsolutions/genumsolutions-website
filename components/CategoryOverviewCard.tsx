// =====================================================================
// CategoryOverviewCard - the selected category's overview shown BELOW the
// remote-control window on the /tools page, so picking a category stays on
// the page (mirrors the native app's Tools screen). Shows the description,
// "What you can build" bullets, and "Typical hardware" chips.
// =====================================================================
import { categoryBullets } from '../lib/project-catalog'
import type { ProjectCategory } from '../lib/project-catalog'

export default function CategoryOverviewCard({ category }: { category: ProjectCategory }) {
  const points = categoryBullets(category)

  return (
    <section
      aria-label={`About ${category.name}`}
      className="mt-10 rounded-2xl border border-line bg-white p-6 shadow-card lg:p-8"
    >
      <p className="text-[10px] font-black uppercase tracking-widest text-navy">
        {category.name} · overview
      </p>
      <h3 className="mt-2 font-display text-xl font-bold text-ink lg:text-2xl">
        {category.tagline}
      </h3>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-muted">{category.description}</p>

      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-navy">What you can build</p>
          <ul className="mt-3 space-y-2.5">
            {points.map((point) => (
              <li key={point} className="flex items-start gap-2 text-sm leading-6 text-muted">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                {point}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-xs font-black uppercase tracking-widest text-navy">Typical hardware</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {category.hardware.map((item) => (
              <li
                key={item}
                className="whitespace-nowrap rounded-full bg-mist px-3 py-1.5 text-xs font-bold text-navy"
              >
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs leading-5 text-muted">
            The control window above drives this category over the same Bluetooth / WiFi transport
            used by the robot cars.
          </p>
        </div>
      </div>
    </section>
  )
}
