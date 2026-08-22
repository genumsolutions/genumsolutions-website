import { createHmac, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'

const COOKIE_NAME = 'genum-admin-session'
const SESSION_VALUE = 'authenticated'

function secret() {
  return process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || 'change-this-secret'
}

export function isAdminConfigured() {
  return Boolean(process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD)
}

export function createAdminToken() {
  return createHmac('sha256', secret()).update(SESSION_VALUE).digest('hex')
}

export function isValidAdminToken(token: string | undefined) {
  if (!token) return false
  const expected = createAdminToken()
  const provided = Buffer.from(token)
  const known = Buffer.from(expected)
  return provided.length === known.length && timingSafeEqual(provided, known)
}

export function isAdminRequest() {
  return isValidAdminToken(cookies().get(COOKIE_NAME)?.value)
}

export function adminCookie(token: string) {
  return { name: COOKIE_NAME, value: token, httpOnly: true, sameSite: 'lax' as const, secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 8 }
}

export { COOKIE_NAME }
