'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function AdminLoginPage() {
  const router = useRouter()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    const form = new FormData(event.currentTarget)
    const response = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: form.get('username'), password: form.get('password') }) })
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      setError(body.error || 'Unable to sign in.')
      setBusy(false)
      return
    }
    router.push('/admin')
    router.refresh()
  }

  return <main className="grid-paper flex min-h-screen items-center justify-center px-5"><form onSubmit={submit} className="w-full max-w-md border-t-4 border-cobalt bg-white p-8 shadow-xl"><Link href="/" className="text-sm font-bold text-cobalt">GENUM SOLUTIONS</Link><h1 className="mt-10 font-display text-4xl font-bold text-ink">Admin sign in</h1><p className="mt-3 text-sm leading-6 text-slate-600">Manage products and homepage content from one private workspace.</p><label className="mt-8 block text-sm font-bold text-ink">Username<input name="username" required className="mt-2 w-full border border-line px-4 py-3 outline-none focus:border-cobalt" /></label><label className="mt-5 block text-sm font-bold text-ink">Password<input name="password" type="password" required className="mt-2 w-full border border-line px-4 py-3 outline-none focus:border-cobalt" /></label>{error && <p className="mt-4 text-sm font-bold text-red-600">{error}</p>}<button disabled={busy} className="mt-7 w-full bg-cobalt px-5 py-3.5 text-sm font-black text-white disabled:opacity-60">{busy ? 'Signing in...' : 'Sign in'}</button></form></main>
}
