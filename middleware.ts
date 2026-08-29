import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { checkRateLimit, clientIp } from './lib/rate-limit'

// Only refresh Supabase auth cookies on routes that need session state.
// Public pages (/, /about, /products, etc.) skip the auth call entirely,
// saving ~200-400 ms per page load.
const AUTH_PATHS = ['/admin', '/account', '/checkout', '/login', '/api/']

// Coarse, burst-style per-IP guard for the public / state-changing API routes.
// These caps are intentionally high so they only trip on abuse / scrapers;
// the individual route handlers keep their stricter, purpose-specific limits
// (e.g. 10 login attempts per IP per minute). Keeping both layers avoids a
// single point of control and protects routes that have no inline guard.
const API_RATE_LIMITS: Array<{ prefix: string; limit: number }> = [
  { prefix: '/api/auth/', limit: 30 },
  { prefix: '/api/checkout/', limit: 30 },
  { prefix: '/api/cart', limit: 60 },
  { prefix: '/api/orders', limit: 60 },
  { prefix: '/api/customer/', limit: 60 },
  { prefix: '/api/track', limit: 60 },
  { prefix: '/api/contact', limit: 20 },
  { prefix: '/api/products', limit: 120 },
  { prefix: '/api/admin/', limit: 120 },
]

function needsAuthRefresh(pathname: string) {
  return AUTH_PATHS.some((prefix) => pathname === prefix || pathname.startsWith(prefix + '/'))
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const { pathname } = request.nextUrl
  if (!needsAuthRefresh(pathname)) return response

  // Per-IP burst guard for public / state-changing API routes.
  if (pathname.startsWith('/api/')) {
    const rule = API_RATE_LIMITS.find(
      (r) => pathname === r.prefix || pathname.startsWith(r.prefix),
    )
    if (rule) {
      const limit = checkRateLimit(`api:${rule.prefix}:${clientIp(request)}`, rule.limit, 60_000)
      if (!limit.allowed) {
        return NextResponse.json(
          { error: 'Too many requests. Please try again shortly.' },
          { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
        )
      }
    }
  }

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
    const {
      data: { user },
    } = await supabase.auth.getUser()
    // Edge guard for the admin UI: bounce unauthenticated users to login.
    // /admin/login is the sign-in page itself, so it stays reachable.
    if (pathname.startsWith('/admin') && pathname !== '/admin/login' && !user) {
      const loginUrl = request.nextUrl.clone()
      loginUrl.pathname = '/login'
      loginUrl.search = `?next=${encodeURIComponent(pathname)}`
      return NextResponse.redirect(loginUrl)
    }
  } catch {
    // Network hiccup - pages handle unauthenticated state gracefully.
  }
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logo.png|images/.*|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
}
