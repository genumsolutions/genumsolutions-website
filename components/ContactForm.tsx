'use client'

import { FormEvent, useState } from 'react'

export default function ContactForm() {
  const [status, setStatus] = useState('')
  const [sending, setSending] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSending(true)
    setStatus('Sending...')
    const form = event.currentTarget
    const data = Object.fromEntries(new FormData(form).entries())
    try {
      const response = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      const result = await response.json()
      setStatus(result.message || result.error)
      if (response.ok) form.reset()
    } catch {
      setStatus('We could not send your inquiry right now. Please email us directly.')
    } finally {
      setSending(false)
    }
  }

  return <form className="grid gap-3" onSubmit={submit}>
    <input name="name" required maxLength={100} className="border border-line bg-white px-4 py-3 text-sm" placeholder="Name" autoComplete="name" />
    <input name="email" required maxLength={254} className="border border-line bg-white px-4 py-3 text-sm" placeholder="Email" type="email" autoComplete="email" />
    <textarea name="message" required maxLength={5000} className="min-h-36 border border-line bg-white px-4 py-3 text-sm" placeholder="What are you working on?" />
    <button className="bg-cobalt px-5 py-3 text-sm font-black text-white disabled:cursor-wait disabled:opacity-60" type="submit" disabled={sending}>{sending ? 'Sending...' : 'Send inquiry ↗'}</button>
    {status && <p role="status" className="text-sm text-slate-600">{status}</p>}
  </form>
}
