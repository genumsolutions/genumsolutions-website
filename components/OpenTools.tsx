'use client'

import { useState } from 'react'

type Tool = { group: string; name: string; description: string; href: string }

const tools: Tool[] = [
  { group: 'CAD & 3D', name: 'OpenSCAD', description: 'Parametric 3D design for printable parts.', href: 'https://openscad.org/' },
  { group: 'CAD & 3D', name: 'FreeCAD', description: 'Open-source mechanical CAD for precise models.', href: 'https://www.freecad.org/' },
  { group: 'Slicing', name: 'PrusaSlicer', description: 'Prepare STL and 3MF files for FDM printing.', href: 'https://www.prusa3d.com/page/prusaslicer_424/' },
  { group: 'Electronics', name: 'KiCad', description: 'Design schematics and PCBs without a subscription.', href: 'https://www.kicad.org/' },
  { group: 'Robotics', name: 'Arduino IDE', description: 'Write and upload firmware for classroom boards.', href: 'https://www.arduino.cc/en/software/' },
  { group: 'Robotics', name: 'PlatformIO', description: 'A professional embedded development workflow.', href: 'https://platformio.org/' },
  { group: 'Simulation', name: 'Wokwi', description: 'Simulate Arduino and ESP32 projects in the browser.', href: 'https://wokwi.com/' },
  { group: 'Images', name: 'Wikimedia Commons', description: 'Reusable media and diagrams with license details.', href: 'https://commons.wikimedia.org/' },
]

export default function OpenTools() {
  const [filter, setFilter] = useState('All')
  const groups = ['All', ...Array.from(new Set(tools.map((tool) => tool.group)))]
  const visible = tools.filter((tool) => filter === 'All' || tool.group === filter)

  return (
    <section className="mx-auto max-w-7xl px-5 py-12 lg:px-8 lg:py-16">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter tools by category">
        {groups.map((group) => (
          <button key={group} onClick={() => setFilter(group)} aria-pressed={filter === group} className={`rounded-full px-4 py-2 text-xs font-bold transition ${filter === group ? 'bg-navy text-white' : 'border border-line bg-white text-muted hover:border-navy hover:text-navy'}`}>
            {group}
          </button>
        ))}
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {visible.map((tool) => (
          <article key={tool.name} className="rounded-2xl border-t-2 border-navy bg-white p-5 shadow-card">
            <p className="text-[10px] font-black uppercase tracking-widest text-navy">{tool.group}</p>
            <h2 className="mt-8 font-display text-xl font-bold">{tool.name}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">{tool.description}</p>
            <a href={tool.href} target="_blank" rel="noreferrer" className="mt-6 inline-block text-sm font-bold text-navy underline decoration-gold decoration-2 underline-offset-4 transition hover:text-navy-dark">Open tool ↗</a>
          </article>
        ))}
      </div>
    </section>
  )
}
