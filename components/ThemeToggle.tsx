'use client'

import { useEffect, useState } from 'react'

export default function ThemeToggle() {
  const [dim, setDim] = useState(false)
  useEffect(() => { setDim(window.localStorage.getItem('genum-theme') === 'dim') }, [])
  function toggle() {
    const next = !dim
    setDim(next)
    document.documentElement.dataset.theme = next ? 'dim' : 'light'
    window.localStorage.setItem('genum-theme', next ? 'dim' : 'light')
  }
  return <button onClick={toggle} aria-label={dim ? 'Use light mode' : 'Use dim mode'} title={dim ? 'Light mode' : 'Dim mode'} className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-white text-lg text-ink">{dim ? '☼' : '◐'}</button>
}
