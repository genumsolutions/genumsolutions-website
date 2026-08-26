import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './lib/**/*.{js,ts,jsx,tsx}',
    './public/media/**.{jpg,png,svg}',
  ],
  theme: {
    extend: {
      colors: {
        ink: '#0f172a',
        navy: '#1e3a8a',
        'navy-dark': '#172554',
        'navy-light': '#dbe4f8',
        sky: '#e3eaf7',
        mist: '#f8fafc',
        gold: '#b45309',
        'gold-dark': '#92400e',
        line: '#e2e8f0',
        border: '#94a3b8',
        surface: '#ffffff',
        muted: '#64748b',
        accent: '#059669',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        display: ['var(--font-sora)', 'Georgia', 'serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      borderRadius: {
        lg: '0.5rem',
        md: '0.375rem',
        sm: '0.25rem',
        DEFAULT: '0.5rem',
      },
      boxShadow: {
        card: '0 1px 2px 0 rgba(15, 23, 42, 0.05), 0 1px 3px -1px rgba(15, 23, 42, 0.1)',
        glow: '0 0 0 1px rgba(30, 58, 138, 0.5), 0 4px 6px -1px rgba(15, 23, 42, 0.1)',
        neon: '0 0 30px rgba(30, 58, 138, 0.22), 0 0 0 1px rgba(30, 58, 138, 0.1)',
      },
      transitionProperty: {
        width: 'width',
        height: 'height',
        spacing: 'margin padding',
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-out',
        'fade-in-up': 'fade-in-up 0.3s ease-out',
        'scale-in': 'scale-in 0.2s ease-out',
        'scale-out': 'scale-out 0.2s ease-out',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in-up': {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { transform: 'scale(0.95)', opacity: '0' },
          to: { transform: 'scale(1)', opacity: '1' },
        },
        'scale-out': {
          from: { transform: 'scale(1)', opacity: '1' },
          to: { transform: 'scale(0.95)', opacity: '0' },
        },
      },
    },
  },
  plugins: [],
}

export default config
