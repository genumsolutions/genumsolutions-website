'use client'

import { useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
import { getPushStatus, subscribeToPush } from '../lib/web-push'

// Compact checkout opt-in (W-3): shown to signed-in customers while they have
// items in the build list. Asks once, remembers "Not now", never nags — and
// only ever triggers the browser permission prompt from the explicit click.
export default function CheckoutPushOptIn() {
  const [state, setState] = useState<'hidden' | 'ready' | 'busy'>('hidden')

  useEffect(() => {
    getPushStatus()
      .then((status) => {
        if (status.supported && !status.subscribed && status.permission !== 'denied' && window.localStorage.getItem('genum-push-optout') !== '1') {
          setState('ready')
        }
      })
      .catch(() => undefined)
  }, [])

  if (state === 'hidden') return null

  async function onTurnOn() {
    setState('busy')
    const result = await subscribeToPush()
    // On failure (not configured, dismissed, unsupported) stop asking this browser.
    if (!result.ok) window.localStorage.setItem('genum-push-optout', '1')
    setState('hidden')
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-white p-4 text-sm animate-fade-in">
      <Bell size={16} aria-hidden="true" className="shrink-0 text-navy" />
      <span className="text-slate-600">Want a push notification when your order status changes?</span>
      {state === 'busy' ? (
        <span className="font-bold text-muted">Asking your browser…</span>
      ) : (
        <>
          <button onClick={onTurnOn} className="rounded-lg bg-navy px-4 py-2 text-xs font-bold text-white transition hover:bg-navy-dark">
            Turn on
          </button>
          <button
            onClick={() => { window.localStorage.setItem('genum-push-optout', '1'); setState('hidden') }}
            className="text-xs font-bold text-muted underline"
          >
            Not now
          </button>
        </>
      )}
    </div>
  )
}
