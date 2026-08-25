'use client'

import { useState } from 'react'

const modelSites = [
  ['Printables', 'https://www.printables.com/', 'Community models, printer profiles, and makes.'],
  ['Thingiverse', 'https://www.thingiverse.com/', 'A large library of community-created printable models.'],
  ['MakerWorld', 'https://makerworld.com/en', 'Printable models and profiles for modern maker workflows.'],
  ['MyMiniFactory', 'https://www.myminifactory.com/', 'Curated models for makers, miniatures, and education.'],
  ['NASA 3D Resources', 'https://nasa3d.arc.nasa.gov/', 'Public NASA spacecraft, science, and mission models.'],
  ['NIH 3D Print Exchange', 'https://3dprint.nih.gov/', 'Open biomedical and scientific 3D-printable models.'],
]

export default function ModelBrowser() {
  const [active, setActive] = useState(modelSites[0])
  return (
    <section className="mt-16 border-t border-line pt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[.24em] text-cobalt">Open model library</p>
          <h2 className="mt-2 font-display text-3xl font-bold">Browse before you design.</h2>
        </div>
        <a href={active[1]} target="_blank" rel="noreferrer" className="rounded-full bg-ink px-4 py-2 text-sm font-black text-white transition hover:bg-cobalt">Open full site ↗</a>
      </div>
      <div className="mt-6 grid gap-5 lg:grid-cols-[220px_1fr]">
        <div className="grid content-start gap-2">
          {modelSites.map((site) => (
            <button key={site[0]} onClick={() => setActive(site)} className={`border-l-2 px-4 py-3 text-left text-sm font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cobalt ${active[0] === site[0] ? 'border-cobalt bg-white text-cobalt' : 'border-line text-muted hover:border-cobalt hover:text-cobalt'}`}>
              <span className="block">{site[0]}</span>
              <span className="mt-1 block text-xs font-normal text-muted">{site[2]}</span>
            </button>
          ))}
        </div>
        <div className="overflow-hidden rounded-2xl border border-line bg-white">
          <iframe title={`${active[0]} model browser`} src={active[1]} className="h-[320px] w-full sm:h-[420px] lg:h-[520px]" loading="lazy" />
        </div>
      </div>
    </section>
  )
}
