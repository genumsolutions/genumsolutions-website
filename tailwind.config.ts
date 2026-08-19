import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: { extend: { colors: { ink: '#101b3d', cobalt: '#173eaa', sky: '#eaf2ff', mist: '#f6f8fc', signal: '#efb73d', line: '#dbe3f2' }, fontFamily: { sans: ['var(--font-manrope)', 'sans-serif'], display: ['var(--font-space)', 'sans-serif'] } } },
  plugins: [],
}
export default config
