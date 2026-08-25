import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Only refresh Supabase auth cookies on routes that need session state.
// Public pages (/, /about, /products, etc.) skip the auth call entirely,
// saving ~200-400 ms per page load.
const AUTH_PATHS = ['/admin', '/account', '/checkout', '/login', '/api/']

function needsAuthRefresh(pathname: string) {
  return AUTH_PATHS.some((prefix) => pathname === prefix || pathname.startsWith(prefix + '/'))
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  if (!needsAuthRefresh(request.nextUrl.pathname)) return response

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return response

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })

  try {
    await supabase.auth.getUser()
  } catch {
    // Network hiccup - pages handle unauthenticated state gracefully.
  }
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logo.png|images/.*|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
}
