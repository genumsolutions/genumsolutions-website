'use client'

import { FormEvent, useState } from 'react'
import { inputClass } from '../lib/styles'

export default function ContactForm() {
  const [status, setStatus] = useState('')
  const [isError, setIsError] = useState(false)
  const [sending, setSending] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSending(true)
    setStatus('Sending...')
    setIsError(false)
    const form = event.currentTarget
    const data = Object.fromEntries(new FormData(form).entries())
    try {
      const response = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      const result = await response.json()
      setStatus(result.message || result.error)
      setIsError(!response.ok)
      if (response.ok) form.reset()
    } catch {
      setStatus('We could not send your inquiry right now. Please email us directly.')
      setIsError(true)
    } finally {
      setSending(false)
    }
  }

  return <form className="grid gap-3" onSubmit={submit}>
    <label className="block text-sm font-bold text-ink">Name
      <input name="name" required maxLength={100} className={`mt-2 w-full ${inputClass}`} placeholder="Your name" autoComplete="name" />
    </label>
    <label className="block text-sm font-bold text-ink">Email
      <input name="email" required maxLength={254} className={`mt-2 w-full ${inputClass}`} placeholder="you@example.com" type="email" autoComplete="email" />
    </label>
    <label className="block text-sm font-bold text-ink">Message
      <textarea name="message" required maxLength={5000} className={`mt-2 min-h-36 w-full ${inputClass}`} placeholder="What are you working on?" />
    </label>
    <button className="rounded-lg bg-navy px-5 py-3 text-sm font-black text-white transition hover:bg-navy-dark disabled:cursor-wait disabled:opacity-60" type="submit" disabled={sending}>{sending ? 'Sending...' : 'Send inquiry ↗'}</button>
    {status && <p role={isError ? 'alert' : 'status'} className={`text-sm font-semibold ${isError ? 'text-red-600' : 'text-emerald-700'}`}>{status}</p>}
  </form>
}
