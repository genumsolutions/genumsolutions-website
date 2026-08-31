import { Cog } from 'lucide-react'

// Creative hero emblem for page intros - an orbiting-satellite mark that
// echoes the brand ring without repeating the flat header logo. Pure CSS,
// dim-theme safe (uses brand tokens + transparent overlays).
export default function HeroMark() {
  return (
    <div className="hero-mark" aria-hidden="true">
      <span className="hero-ring" />
      <span className="hero-ring dark" />
      <span className="hero-sat" />
      <span className="hero-sat two" />
      <div className="brand-motif">
        <span><Cog size={18} strokeWidth={1.75} /></span>
        <i />
        <b />
      </div>
    </div>
  )
}
