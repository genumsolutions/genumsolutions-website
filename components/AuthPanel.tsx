'use client'

import Link from 'next/link'
import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { initials } from '../lib/identity'

type Mode = 'signin' | 'signup' | 'forgot'

const callbackErrors: Record<string, string> = {
  link: 'That email link is invalid, expired, or already used. Start again to get a fresh one.',
  google: 'Google sign-in failed or was cancelled.',
  config: 'Google sign-in is not configured yet. Use email and password for now.',
}

const GoogleIcon = (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </svg>
)

const perks = [
  { title: 'Your build list, everywhere', body: 'Carts and saved parts follow you across devices.' },
  { title: 'Orders at a glance', body: 'Live status from checkout to doorstep or pickup.' },
  { title: 'Priority workshop support', body: 'Messages route straight to our engineers.' },
]

async function mergeLocalCart() {
  const localCart = JSON.parse(window.localStorage.getItem('genum-cart') || '[]')
  if (localCart.length) {
    await fetch('/api/cart', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cart: localCart }) })
  }
}

const inputClass = 'mt-2 w-full border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition-colors focus:border-cobalt'
const labelClass = 'block text-sm font-bold text-ink'

export default function AuthPanel({ initialMode = 'signin' }: { initialMode?: Mode }) {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>(initialMode)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    const problem = new URLSearchParams(window.location.search).get('error')
    if (problem && callbackErrors[problem]) setError(callbackErrors[problem])
  }, [])

  function switchMode(next: Mode) {
    setMode(next); setError(''); setNotice(''); setShowPassword(false)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('')
    const form = Object.fromEntries(new FormData(event.currentTarget).entries())
    const endpoint = mode === 'signin' ? '/api/auth/login' : mode === 'signup' ? '/api/auth/register' : '/api/auth/reset'
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) { setError(result.error || 'Something went wrong. Please try again.'); setBusy(false); return }
      if (mode === 'forgot') {
        setNotice('If an account exists for that email, a password-reset link is on its way.'); setBusy(false); return
      }
      if (result.needsEmailConfirmation) {
        switchMode('signin')
        setNotice('Account created. Check your email and confirm your address, then sign in.'); setBusy(false); return
      }
      await mergeLocalCart()
      router.replace(result.role === 'admin' ? '/admin' : '/account')
      router.refresh()
    } catch {
      setError('Network error. Please try again.'); setBusy(false)
    }
  }

  const copy: Record<Mode, { title: string; body: string; button: string }> = {
    signin: { title: 'Welcome back.', body: 'Sign in to pick up your build list, track orders, and manage the site if you are staff.', button: 'Sign in' },
    signup: { title: 'Create your account.', body: 'One account for orders, saved builds, and support - free, and ready in under a minute.', button: 'Create account' },
    forgot: { title: 'Reset your password.', body: 'Enter your account email and we will send you a secure reset link.', button: 'Send reset link' },
  }

  return (
    <main className="grid-paper min-h-[calc(100vh-64px)]">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-5 py-14 lg:grid-cols-[1fr_420px] lg:gap-16 lg:px-8">
        <aside className="hidden lg:block">
          <p className="text-xs font-black uppercase tracking-[.25em] text-cobalt">GENUM Solutions Pvt. Ltd.</p>
          <h2 className="mt-4 font-display text-5xl font-bold leading-[1.05] text-ink">One account.<br />Every build.</h2>
          <ul className="mt-10 space-y-7">
            {perks.map((perk) => (
              <li key={perk.title} className="flex gap-4">
                <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cobalt text-xs font-black text-white">{initials(perk.title).slice(0, 1)}</span>
                <span><strong className="block font-display text-lg text-ink">{perk.title}</strong><span className="mt-1 block text-sm leading-6 text-slate-600">{perk.body}</span></span>
              </li>
            ))}
          </ul>
          <p className="mt-12 border-t border-line pt-5 text-xs font-bold uppercase tracking-widest text-slate-400">Robotics · Electronics · 3D printing · AI — Kathmandu, Nepal</p>
        </aside>

        <section className="w-full justify-self-center">
          <div className="stamp-ring border-t-4 border-cobalt bg-white p-7 sm:p-9">
            <Link href="/" className="text-sm font-bold text-cobalt lg:hidden">GENUM SOLUTIONS</Link>
            <h1 className="mt-8 font-display text-3xl font-bold text-ink sm:text-4xl lg:mt-0">{copy[mode].title}</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">{copy[mode].body}</p>

            {error && <p role="alert" className="mt-5 border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</p>}
            {notice && <p role="status" className="mt-5 border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{notice}</p>}

            <form onSubmit={submit}>
              {mode === 'signup' && (
                <label className={`${labelClass} mt-7 block`}>Full name<input name="name" required minLength={2} autoComplete="name" className={inputClass} /></label>
              )}
              <label className={`${labelClass} mt-5 block`}>Email<input name="email" type="email" required autoComplete="email" className={inputClass} /></label>

              {mode !== 'forgot' && (
                <label className={`${labelClass} mt-5 block`}>
                  Password
                  <span className="relative mt-2 block">
                    <input name="password" type={showPassword ? 'text' : 'password'} required minLength={6} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} className={`${inputClass} pr-16`} />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute inset-y-0 right-0 px-4 text-xs font-black uppercase tracking-wide text-slate-500 hover:text-cobalt">
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </span>
                </label>
              )}

              {mode === 'signin' && (
                <button type="button" onClick={() => switchMode('forgot')} className="mt-3 block text-sm font-bold text-cobalt underline">Forgot password?</button>
              )}

              <button disabled={busy} className="mt-7 w-full bg-cobalt px-5 py-3.5 text-sm font-black text-white transition-opacity disabled:opacity-60">
                {busy ? 'Please wait…' : copy[mode].button}
              </button>
            </form>

            {mode !== 'forgot' && (
              <>
                <div className="my-6 flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-slate-400"><span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" /></div>
                <a href="/api/auth/google" className="flex w-full items-center justify-center gap-3 border border-line px-5 py-3.5 text-sm font-black text-ink transition-colors hover:border-cobalt hover:bg-mist">{GoogleIcon}Continue with Google</a>
              </>
            )}

            <div className="mt-6 space-y-2 border-t border-line pt-5">
              {mode !== 'signup' && <button type="button" onClick={() => switchMode('signup')} className="block text-sm font-bold text-cobalt underline">New here? Create a customer account</button>}
              {mode !== 'signin' && <button type="button" onClick={() => switchMode('signin')} className="block text-sm font-bold text-cobalt underline">I already have an account</button>}
              {mode === 'forgot' && <button type="button" onClick={() => switchMode('signin')} className="block text-sm font-bold text-cobalt underline">Back to sign in</button>}
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
