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
        ink: '#111827',
        cobalt: '#2563eb',
        'cobalt-dark': '#1d4ed8',
        'cobalt-light': '#dbeafe',
        sky: '#e0e7ff',
        mist: '#f9fafb',
        signal: '#f59e0b',
        'signal-dark': '#d97706',
        line: '#d1d5db',
        border: '#9ca3af',
        surface: '#ffffff',
        muted: '#6b7280',
        accent: '#10b981',
        robotics: '#0d9488',
      },
      fontFamily: {
        sans: ['var(--font-manrope)', 'system-ui', 'sans-serif'],
        display: ['var(--font-space)', 'Georgia', 'serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      borderRadius: {
        lg: '0.5rem',
        md: '0.375rem',
        sm: '0.25rem',
        DEFAULT: '0.5rem',
      },
      boxShadow: {
        card: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
        glow: '0 0 0 1px rgba(37, 99, 235, 0.5), 0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        neon: '0 0 30px rgba(37, 99, 235, 0.25), 0 0 0 1px rgba(37, 99, 235, 0.1)',
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
