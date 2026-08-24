import { createClient, supabaseConfigured } from './supabase/server'

// Admin is any signed-in user whose profile row has role = 'admin'.
// Returns the admin identity so pages can greet them; null for everyone else.
export async function getCurrentAdmin(): Promise<{ id: string; email: string } | null> {
  if (!supabaseConfigured()) return null
  try {
    const supabase = createClient()
    const { data } = await supabase.auth.getUser()
    if (!data.user) return null
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).maybeSingle()
    if (profile?.role !== 'admin') return null
    return { id: data.user.id, email: data.user.email ?? '' }
  } catch {
    return null
  }
}

export async function isAdminRequest(): Promise<boolean> {
  return Boolean(await getCurrentAdmin())
}
