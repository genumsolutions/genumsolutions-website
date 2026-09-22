import { createClient, supabaseConfigured } from './supabase/server'

// Admin is any signed-in user whose profile row has role in ('staff','admin','owner').
export async function getCurrentAdmin(): Promise<{ id: string; email: string } | null> {
  if (!supabaseConfigured()) return null
  try {
    const supabase = createClient()
    const { data } = await supabase.auth.getUser()
    if (!data.user) return null
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).maybeSingle()
    const role = String(profile?.role || '')
    if (role !== 'staff' && role !== 'admin' && role !== 'owner') return null
    return { id: data.user.id, email: data.user.email ?? '' }
  } catch {
    return null
  }
}

// Admin gate is admin+owner only; staff must not pass here (they get
// isStaffRequest instead). Reads and day-to-day editing are staff+, but role
// assignment and every destructive delete require admin.
export async function isAdminRequest(): Promise<boolean> {
  if (!supabaseConfigured()) return false
  try {
    const supabase = createClient()
    const { data } = await supabase.auth.getUser()
    if (!data.user) return false
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).maybeSingle()
    const role = String(profile?.role || '')
    return role === 'admin' || role === 'owner'
  } catch {
    return false
  }
}

export async function isStaffRequest(): Promise<boolean> {
  if (!supabaseConfigured()) return false
  try {
    const supabase = createClient()
    const { data } = await supabase.auth.getUser()
    if (!data.user) return false
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).maybeSingle()
    const role = String(profile?.role || '')
    return role === 'staff' || role === 'admin' || role === 'owner'
  } catch {
    return false
  }
}

export async function isOwnerRequest(): Promise<boolean> {
  if (!supabaseConfigured()) return false
  try {
    const supabase = createClient()
    const { data } = await supabase.auth.getUser()
    if (!data.user) return false
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).maybeSingle()
    return String(profile?.role || '') === 'owner'
  } catch {
    return false
  }
}

// Raw role string for the signed-in admin ('staff' | 'admin' | 'owner'), used
// by the server page to hand UI gating to the client admin shell.
export async function getCurrentUserRole(): Promise<'staff' | 'admin' | 'owner' | null> {
  if (!supabaseConfigured()) return null
  try {
    const supabase = createClient()
    const { data } = await supabase.auth.getUser()
    if (!data.user) return null
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).maybeSingle()
    const role = String(profile?.role || '')
    if (role !== 'staff' && role !== 'admin' && role !== 'owner') return null
    return role
  } catch {
    return null
  }
}
