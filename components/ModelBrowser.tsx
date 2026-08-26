'use client'

import { useState } from 'react'

type ModelSite = { name: string; url: string; blurb: string }

const modelSites: ModelSite[] = [
  { name: 'Printables', url: 'https://www.printables.com/', blurb: 'Community models, printer profiles, and makes.' },
  { name: 'Thingiverse', url: 'https://www.thingiverse.com/', blurb: 'A large library of community-created printable models.' },
  { name: 'MakerWorld', url: 'https://makerworld.com/en', blurb: 'Printable models and profiles for modern maker workflows.' },
  { name: 'MyMiniFactory', url: 'https://www.myminifactory.com/', blurb: 'Curated models for makers, miniatures, and education.' },
  { name: 'NASA 3D Resources', url: 'https://nasa3d.arc.nasa.gov/', blurb: 'Public NASA spacecraft, science, and mission models.' },
  { name: 'NIH 3D Print Exchange', url: 'https://3dprint.nih.gov/', blurb: 'Open biomedical and scientific 3D-printable models.' },
]

export default function ModelBrowser() {
  const [active, setActive] = useState<ModelSite>(modelSites[0]!)
  return (
    <section className="mt-16 border-t border-line pt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[.24em] text-navy">Open model library</p>
          <h2 className="mt-2 font-display text-3xl font-bold">Browse before you design.</h2>
        </div>
        <a href={active.url} target="_blank" rel="noreferrer" className="rounded-full bg-ink px-4 py-2 text-sm font-black text-white transition hover:bg-navy">Open full site ↗</a>
      </div>
      <div className="mt-6 grid gap-5 lg:grid-cols-[220px_1fr]">
        <div className="grid content-start gap-2">
          {modelSites.map((site) => (
            <button key={site.name} onClick={() => setActive(site)} className={`border-l-2 px-4 py-3 text-left text-sm font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy ${active.name === site.name ? 'border-navy bg-white text-navy' : 'border-line text-muted hover:border-navy hover:text-navy'}`}>
              <span className="block">{site.name}</span>
              <span className="mt-1 block text-xs font-normal text-muted">{site.blurb}</span>
            </button>
          ))}
        </div>
        <div className="overflow-hidden rounded-2xl border border-line bg-white">
          <iframe title={`${active.name} model browser`} src={active.url} className="h-[320px] w-full sm:h-[420px] lg:h-[520px]" loading="lazy" />
        </div>
      </div>
    </section>
  )
}
