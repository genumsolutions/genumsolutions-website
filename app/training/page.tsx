import PageIntro from '../../components/PageIntro'
import PageShell from '../../components/PageShell'
import { pilotCosts, stemProjectHighlights, trainingPrograms } from '../../lib/programs'
import { formatNPR } from '../../lib/catalog'
import { RoboticArm } from '../../components/Robotics3D'

export default function TrainingPage() {
  return (
    <PageShell>
      <section className="mx-auto max-w-7xl px-5 py-14 lg:px-8">
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <h1 className="font-display text-3xl font-bold text-ink mb-6">
              Training Programs that Build Careers
            </h1>
            <p className="text-slate-600 leading-relaxed">
              GENUM&apos;s source curriculum combines 100+ age-banded STEM projects with
              modular robotics, teacher enablement, and measurable pilot support.
            </p>
          </div>
          <div className="space-y-6">
            {trainingPrograms.map((program, i) => (
              <div key={program.title} className="border-t-2 border-ink bg-white p-6">
                <h3 className="font-display text-xl font-bold mb-3">
                  {program.title}
                </h3>
                <p className="text-slate-500 text-sm leading-relaxed">
                  {program.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Pilot Costs Section with NPR */}
        <section className="mt-16 border-y border-line py-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl font-bold mb-4">Pilot Investment</h2>
              <p className="text-xs font-black uppercase tracking-[.24em] text-cobalt">
                Indicative NPR amounts (excluding VAT), confirmed after scope review
              </p>
            </div>
            <RoboticArm />
          </div>

          <div className="mt-8 grid grid-cols-2 gap-4">
            {pilotCosts.map(([item, amount, detail]) => (
              <div key={item} className="border-t border-line pt-4">
                <p className="text-xs font-black uppercase tracking-widest text-cobalt">{item}</p>
                <p className="font-bold text-2xl text-cobalt">{amount}</p>
                <p className="text-xs text-slate-500">{detail}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Stem Project Highlights */}
        <section className="mt-16 border-y border-line py-10">
          <h2 className="font-display text-2xl font-bold mb-6 text-center">
            STEM Project Highlights
          </h2>
          <div className="grid grid-cols-2 gap-4">
            {stemProjectHighlights[0].map((project) => (
              <div key={project} className="border-b border-line pb-3">
                <p className="text-xs font-black uppercase tracking-widest text-signal">{project}</p>
              </div>
            ))}
            {stemProjectHighlights[1].map((project) => (
              <div key={project} className="border-b border-line pb-3">
                <p className="text-xs font-black uppercase tracking-widest text-signal">{project}</p>
              </div>
            ))}
            {stemProjectHighlights[2].map((project) => (
              <div key={project} className="border-b border-line pb-3">
                <p className="text-xs font-black uppercase tracking-widest text-signal">{project}</p>
              </div>
            ))}
          </div>
        </section>
      </section>
    </PageShell>
  )
}