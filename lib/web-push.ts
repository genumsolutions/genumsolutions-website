// =====================================================================
// Client-side Web Push helper (W-3 — standards-based VAPID push, NO
// Firebase). The VAPID public key is inlined at build time from
// NEXT_PUBLIC_VAPID_PUBLIC_KEY; subscriptions are stored per-user in
// Supabase via /api/push/subscribe (RLS — own rows only).
// =====================================================================

export type PushStatus = {
  supported: boolean
  permission: NotificationPermission | 'unsupported'
  subscribed: boolean
}

export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const output = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i)
  return output
}

/** Current support/permission/subscription state for this browser. */
export async function getPushStatus(): Promise<PushStatus> {
  if (!pushSupported()) return { supported: false, permission: 'unsupported', subscribed: false }
  try {
    const registration = await navigator.serviceWorker.getRegistration()
    const subscription = registration ? await registration.pushManager.getSubscription() : null
    return { supported: true, permission: Notification.permission, subscribed: Boolean(subscription) }
  } catch {
    return { supported: true, permission: Notification.permission, subscribed: false }
  }
}

/**
 * Ask permission, create (or refresh) the push subscription, and persist it
 * for the signed-in user. MUST be called from a user gesture (button click).
 */
export async function subscribeToPush(): Promise<{ ok: boolean; error?: string }> {
  if (!pushSupported()) return { ok: false, error: 'This browser does not support push notifications.' }
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if (!vapidPublicKey) return { ok: false, error: 'Push is not configured yet — try again later.' }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return { ok: false, error: 'Notification permission was not granted.' }

  const registration = await navigator.serviceWorker.ready
  const existing = await registration.pushManager.getSubscription()
  if (existing) await existing.unsubscribe().catch(() => undefined)

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  })

  const response = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription: subscription.toJSON() }),
  })
  if (!response.ok) {
    await subscription.unsubscribe().catch(() => undefined)
    if (response.status === 401) return { ok: false, error: 'Sign in to turn on notifications.' }
    return { ok: false, error: 'Could not save your notification settings.' }
  }
  return { ok: true }
}

/** Remove this browser's subscription locally and from Supabase. */
export async function unsubscribeFromPush(): Promise<{ ok: boolean; error?: string }> {
  try {
    const registration = await navigator.serviceWorker.getRegistration()
    const subscription = registration ? await registration.pushManager.getSubscription() : null
    await fetch('/api/push/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: subscription?.endpoint ?? null }),
    }).catch(() => undefined)
    if (subscription) await subscription.unsubscribe().catch(() => undefined)
    return { ok: true }
  } catch {
    return { ok: false, error: 'Could not turn notifications off — try again.' }
  }
}
