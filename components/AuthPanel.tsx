'use client'

import Link from 'next/link'
import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

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

async function mergeLocalCart() {
  const localCart = JSON.parse(window.localStorage.getItem('genum-cart') || '[]')
  if (localCart.length) {
    await fetch('/api/cart', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cart: localCart }) })
  }
}

export default function AuthPanel({ initialMode = 'signin' }: { initialMode?: Mode }) {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>(initialMode)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const problem = new URLSearchParams(window.location.search).get('error')
    if (problem && callbackErrors[problem]) setError(callbackErrors[problem])
  }, [])

  function switchMode(next: Mode) {
    setMode(next); setError(''); setNotice('')
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
    signin: { title: 'Sign in', body: 'Customers can save carts, orders, and messages. Admins can manage the website.', button: 'Sign in' },
    signup: { title: 'Create your account', body: 'Save your build list, track orders, and return to your history from any device.', button: 'Create account' },
    forgot: { title: 'Reset password', body: 'Enter your account email and we will send you a reset link.', button: 'Send reset link' },
  }

  return (
    <main className="grid-paper flex min-h-[70vh] items-center justify-center px-5 py-14">
      <form onSubmit={submit} className="w-full max-w-md border-t-4 border-cobalt bg-white p-8 shadow-xl">
        <Link href="/" className="text-sm font-bold text-cobalt">GENUM SOLUTIONS</Link>
        <h1 className="mt-10 font-display text-4xl font-bold text-ink">{copy[mode].title}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">{copy[mode].body}</p>

        {mode === 'signup' && <label className="mt-7 block text-sm font-bold text-ink">Name<input name="name" required minLength={2} className="mt-2 w-full border border-line px-4 py-3 outline-none focus:border-cobalt" /></label>}
        <label className={mode === 'signup' ? 'mt-5 block text-sm font-bold text-ink' : 'mt-8 block text-sm font-bold text-ink'}>Email<input name="email" type="email" required autoComplete="email" className="mt-2 w-full border border-line px-4 py-3 outline-none focus:border-cobalt" /></label>
        {mode !== 'forgot' && <label className="mt-5 block text-sm font-bold text-ink">Password<input name="password" type="password" required minLength={6} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} className="mt-2 w-full border border-line px-4 py-3 outline-none focus:border-cobalt" /></label>}

        {error && <p className="mt-4 text-sm font-bold text-red-600">{error}</p>}
        {notice && <p className="mt-4 text-sm font-bold text-emerald-700">{notice}</p>}

        <button disabled={busy} className="mt-7 w-full bg-cobalt px-5 py-3.5 text-sm font-black text-white disabled:opacity-60">{busy ? 'Please wait...' : copy[mode].button}</button>

        {mode !== 'forgot' && (
          <>
            <div className="my-5 flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-slate-400"><span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" /></div>
            <a href="/api/auth/google" className="flex w-full items-center justify-center gap-3 border border-line px-5 py-3.5 text-sm font-black text-ink hover:border-cobalt">{GoogleIcon}Continue with Google</a>
          </>
        )}

        <div className="mt-5 space-y-2">
          {mode !== 'signup' && <button type="button" onClick={() => switchMode('signup')} className="block text-sm font-bold text-cobalt underline">New here? Create a customer account</button>}
          {mode !== 'signin' && <button type="button" onClick={() => switchMode('signin')} className="block text-sm font-bold text-cobalt underline">I already have an account</button>}
          {mode === 'signin' && <button type="button" onClick={() => switchMode('forgot')} className="block text-sm font-bold text-cobalt underline">Forgot password?</button>}
          {mode === 'forgot' && <button type="button" onClick={() => switchMode('signin')} className="block text-sm font-bold text-cobalt underline">Back to sign in</button>}
        </div>
      </form>
    </main>
  )
}
