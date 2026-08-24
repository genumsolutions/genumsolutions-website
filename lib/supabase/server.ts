import { cookies } from 'next/headers'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createClient as createRawClient, type SupabaseClient } from '@supabase/supabase-js'

export function supabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

function assertConfigured() {
  if (!supabaseConfigured()) throw new Error('Supabase environment variables are not set.')
}

// Cookie-bound client: enforces RLS for the signed-in user. Use in route handlers.
export function createClient(): SupabaseClient {
  assertConfigured()
  const cookieStore = cookies()
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Server Components cannot mutate cookies; middleware refreshes them instead.
        }
      },
    },
  })
}

let serviceClient: SupabaseClient | null = null

// Service-role client: bypasses RLS. SERVER-ONLY - never import from client components.
export function createServiceClient(): SupabaseClient {
  assertConfigured()
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set.')
  if (!serviceClient) {
    serviceClient = createRawClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  }
  return serviceClient
}

export type SessionUser = { id: string; email: string }

// Resolves the signed-in user from the request cookies (null when logged out).
export async function getSessionUser(): Promise<SessionUser | null> {
  if (!supabaseConfigured()) return null
  try {
    const { data } = await createClient().auth.getUser()
    if (!data.user?.email) return null
    return { id: data.user.id, email: data.user.email }
  } catch {
    return null
  }
}
