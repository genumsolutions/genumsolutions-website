'use client'

import { ArrowUpRight, Globe } from 'lucide-react'

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
  return (
    <section className="mt-16 border-t border-line pt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[.24em] text-navy">Open model library</p>
          <h2 className="mt-2 font-display text-3xl font-bold">Browse before you design.</h2>
        </div>
        <p className="max-w-md text-sm leading-6 text-muted">These libraries open in a new tab - they do not allow embedding, so we link straight to the source.</p>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {modelSites.map((site) => (
          <a
            key={site.name}
            href={site.url}
            target="_blank"
            rel="noreferrer"
            className="group flex flex-col rounded-2xl border border-line bg-white p-5 transition hover:-translate-y-0.5 hover:border-navy hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
          >
            <span className="flex items-center justify-between gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-navy-light text-navy transition group-hover:bg-navy group-hover:text-white">
                <Globe size={16} aria-hidden="true" />
              </span>
              <ArrowUpRight size={18} aria-hidden="true" className="text-muted transition group-hover:text-navy" />
            </span>
            <span className="mt-4 font-display text-lg font-bold text-ink">{site.name}</span>
            <span className="mt-1.5 flex-1 text-sm leading-6 text-muted">{site.blurb}</span>
            <span className="mt-3 block truncate text-xs font-bold uppercase tracking-widest text-navy">{new URL(site.url).hostname.replace('www.', '')}</span>
          </a>
        ))}
      </div>
    </section>
  )
}
