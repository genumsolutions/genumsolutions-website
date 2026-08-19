'use client'

import { useState } from 'react'

const tools = [
  ['CAD & 3D', 'OpenSCAD', 'Parametric 3D design for printable parts.', 'https://openscad.org/'],
  ['CAD & 3D', 'FreeCAD', 'Open-source mechanical CAD for precise models.', 'https://www.freecad.org/'],
  ['Slicing', 'PrusaSlicer', 'Prepare STL and 3MF files for FDM printing.', 'https://www.prusa3d.com/page/prusaslicer_424/'],
  ['Electronics', 'KiCad', 'Design schematics and PCBs without a subscription.', 'https://www.kicad.org/'],
  ['Robotics', 'Arduino IDE', 'Write and upload firmware for classroom boards.', 'https://www.arduino.cc/en/software/'],
  ['Robotics', 'PlatformIO', 'A professional embedded development workflow.', 'https://platformio.org/'],
  ['Simulation', 'Wokwi', 'Simulate Arduino and ESP32 projects in the browser.', 'https://wokwi.com/'],
  ['Images', 'Wikimedia Commons', 'Reusable media and diagrams with license details.', 'https://commons.wikimedia.org/'],
]

export default function OpenTools() {
  const [filter, setFilter] = useState('All')
  const groups = ['All', ...Array.from(new Set(tools.map(([group]) => group)))]
  const visible = tools.filter(([group]) => filter === 'All' || group === filter)

  return <section className="mx-auto max-w-7xl px-5 py-12 lg:px-8 lg:py-16"><div className="flex flex-wrap gap-2">{groups.map((group) => <button key={group} onClick={() => setFilter(group)} className={`rounded-full px-4 py-2 text-xs font-black ${filter === group ? 'bg-ink text-white' : 'border border-line bg-white text-slate-600'}`}>{group}</button>)}</div><div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{visible.map(([group, name, description, href]) => <article key={name} className="border-t-2 border-ink bg-white p-5"><p className="text-[10px] font-black uppercase tracking-widest text-cobalt">{group}</p><h2 className="mt-8 font-display text-xl font-bold">{name}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{description}</p><a href={href} target="_blank" rel="noreferrer" className="mt-6 inline-block text-sm font-black text-cobalt underline decoration-signal decoration-2 underline-offset-4">Open tool ↗</a></article>)}</div></section>
}
