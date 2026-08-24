import { createClient, supabaseConfigured } from './supabase/server'

// Admin is now any signed-in user whose profile row has role = 'admin'.
export async function isAdminRequest(): Promise<boolean> {
  if (!supabaseConfigured()) return false
  try {
    const { data } = await createClient().auth.getUser()
    if (!data.user) return false
    const { data: profile } = await createClient()
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .maybeSingle()
    return profile?.role === 'admin'
  } catch {
    return false
  }
}
