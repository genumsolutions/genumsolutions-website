'use client'

import Image from 'next/image'
import Link from 'next/link'
import { FormEvent, useEffect, useState } from 'react'
import { inputClass } from '../lib/styles'

// Final step of password recovery: the visitor arrived here through
// /auth/callback, so the recovery session cookie is already set.
export default function ResetPasswordPanel() {
  const [ready, setReady] = useState<'checking' | 'signed-in' | 'anonymous'>('checking')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetch('/api/customer/me')
      .then((response) => response.json())
      .then((data) => setReady(data.customer ? 'signed-in' : 'anonymous'))
      .catch(() => setReady('anonymous'))
  }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    const form = new FormData(event.currentTarget)
    const password = String(form.get('password') || '')
    const confirm = String(form.get('confirm') || '')
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    if (password !== confirm) { setError('The two passwords do not match.'); return }
    setBusy(true)
    try {
      const response = await fetch('/api/auth/update-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) { setError(result.error || 'Could not update the password. Please try again.'); setBusy(false); return }
      setDone(true)
    } catch {
      setError('Network problem. Please try again.')
    }
    setBusy(false)
  }

  if (done) {
    return <main className="grid-paper flex min-h-[70vh] items-center justify-center px-5 py-14"><div className="w-full max-w-md border-t-4 border-navy bg-white p-8 text-center shadow-xl"><h1 className="font-display text-4xl font-bold">Password updated.</h1><p className="mt-3 text-sm leading-6 text-slate-600">Your new password is active. Use it the next time you sign in.</p><Link href="/account" className="mt-7 inline-block bg-navy px-6 py-3.5 text-sm font-black text-white">Go to your account</Link></div></main>
  }

  if (ready === 'checking') {
    return <main className="grid-paper flex min-h-[70vh] items-center justify-center px-5 py-14"><p className="text-sm font-bold text-slate-500">Checking your recovery link...</p></main>
  }

  if (ready === 'anonymous') {
    return <main className="grid-paper flex min-h-[70vh] items-center justify-center px-5 py-14"><div className="w-full max-w-md border-t-4 border-navy bg-white p-8 shadow-xl"><h1 className="font-display text-3xl font-bold">Link expired or already used.</h1><p className="mt-3 text-sm leading-6 text-slate-600">Recovery links only work once and expire quickly. Start again from the sign-in page to receive a fresh email.</p><Link href="/login" className="mt-7 inline-block bg-navy px-6 py-3.5 text-sm font-black text-white">Back to sign in</Link></div></main>
  }

  return (
    <main className="grid-paper flex min-h-[70vh] items-center justify-center px-5 py-14">
      <form onSubmit={submit} className="w-full max-w-md border-t-4 border-navy bg-white p-8 shadow-xl">
        <Link href="/" className="flex items-center gap-2.5" aria-label="GENUM SOLUTIONS home">
          <span className="relative block h-9 w-9 shrink-0 overflow-hidden rounded-full bg-white shadow-card ring-1 ring-line">
            <Image src="/logo.png" alt="GENUM SOLUTIONS stamp" width={112} height={112} className="h-full w-full object-contain" />
          </span>
          <span className="leading-none">
            <strong className="block font-display text-base font-bold tracking-tight text-ink">GENUM</strong>
            <span className="mt-0.5 block text-[8px] font-bold uppercase tracking-[0.3em] text-navy">Solutions Pvt.&thinsp;Ltd.</span>
          </span>
        </Link>
        <h1 className="mt-10 font-display text-4xl font-bold text-ink">Set a new password</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">Choose a password you have not used elsewhere. At least 6 characters.</p>
        <label className="mt-8 block text-sm font-bold text-ink">New password<input name="password" type="password" required autoComplete="new-password" className={`mt-2 w-full ${inputClass}`} /></label>
        <label className="mt-5 block text-sm font-bold text-ink">Confirm new password<input name="confirm" type="password" required autoComplete="new-password" className={`mt-2 w-full ${inputClass}`} /></label>
        {error && <p className="mt-4 text-sm font-bold text-red-600">{error}</p>}
        <button disabled={busy} className="mt-7 w-full bg-navy px-5 py-3.5 text-sm font-black text-white disabled:opacity-60">{busy ? 'Saving...' : 'Save new password'}</button>
      </form>
    </main>
  )
}
