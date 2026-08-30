// Enforce "one active session per account". Called after any successful sign-in
// (email/password, Google OAuth, native app handoff, immediate signup session).
//
// Supabase issues a fresh session per device/browser, so a user could otherwise
// stay signed in on many devices at once. To keep exactly one, we delete every
// session the user already has except the one just created by this sign-in.
//
// The @supabase/supabase-js client bundled here does not expose the GoTrue admin
// session endpoints (listSessions/deleteSession), so we call the GoTrue admin
// REST API directly with the service-role key:
//   GET  {SUPABASE_URL}/auth/v1/admin/users/{id}/sessions
//   DELETE {SUPABASE_URL}/auth/v1/sessions/{session_id}
// This is version-agnostic and requires only the server-only service-role key.
export async function enforceSingleSession(userId: string): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return // service key unavailable - skip (client-only env)

  const base = url.replace(/\/$/, '')
  const headers = {
    Authorization: `Bearer ${key}`,
    apikey: key,
    'Content-Type': 'application/json',
  }

  try {
    // 1. List the user's existing sessions (created newest first is not
    // guaranteed, so we sort by created_at and keep the newest).
    const list = await fetch(`${base}/auth/v1/admin/users/${encodeURIComponent(userId)}/sessions`, {
      headers,
      cache: 'no-store',
    })
    if (!list.ok) return
    const sessions = (await list.json()) as Array<{ id: string; created_at?: string }>
    if (!Array.isArray(sessions) || sessions.length <= 1) return

    // 2. Delete every session except the newest one (the current sign-in).
    const sorted = [...sessions].sort((a, b) => {
      const at = a.created_at ? new Date(a.created_at).getTime() : 0
      const bt = b.created_at ? new Date(b.created_at).getTime() : 0
      return bt - at
    })
    for (const session of sorted.slice(1)) {
      if (!session.id) continue
      try {
        await fetch(`${base}/auth/v1/sessions/${encodeURIComponent(session.id)}`, {
          method: 'DELETE',
          headers,
          cache: 'no-store',
        })
      } catch {
        // Best-effort; keep going.
      }
    }
  } catch {
    // Best-effort single-session enforcement - never block sign-in on it.
  }
}
