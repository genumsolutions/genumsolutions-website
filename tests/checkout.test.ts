import { describe, expect, it } from 'vitest'
import { clientIp } from '../lib/rate-limit'
import { readCustomerFields } from '../lib/checkout'
import { MAX_QUANTITY_PER_LINE } from '../lib/cart-client'

function req(headers: Record<string, string>): Request {
  return new Request('http://localhost/api/test', { headers })
}

describe('clientIp', () => {
  it('takes the first address from x-forwarded-for', () => {
    expect(clientIp(req({ 'x-forwarded-for': '203.0.113.7, 70.41.3.18' }))).toBe('203.0.113.7')
  })

  it('falls back to x-real-ip when x-forwarded-for is absent', () => {
    expect(clientIp(req({ 'x-real-ip': '198.51.100.9' }))).toBe('198.51.100.9')
  })

  it('ignores an empty x-forwarded-for and uses x-real-ip', () => {
    expect(clientIp(req({ 'x-forwarded-for': '', 'x-real-ip': '198.51.100.9' }))).toBe('198.51.100.9')
  })

  it('returns unknown when no address headers are present', () => {
    expect(clientIp(req({}))).toBe('unknown')
  })
})

describe('readCustomerFields', () => {
  it('extracts and trims customer fields', () => {
    const out = readCustomerFields(
      { customer: { name: '  Aarya Sharma  ', email: ' aarya@example.com ', phone: ' 9812345678 ', address: ' Kathmandu ' } },
      'fallback@example.com',
    )
    expect(out).toEqual({ customerName: 'Aarya Sharma', email: 'aarya@example.com', phone: '9812345678', address: 'Kathmandu' })
  })

  it('falls back to the account email for empty name/email', () => {
    const out = readCustomerFields({ customer: {} }, 'account@example.com')
    expect(out.customerName).toBe('account@example.com')
    expect(out.email).toBe('account@example.com')
  })

  it('caps field lengths to prevent oversized payloads', () => {
    const long = 'x'.repeat(600)
    const out = readCustomerFields(
      { customer: { name: long, email: long, phone: long, address: long } },
      'fallback@example.com',
    )
    expect(out.customerName.length).toBeLessThanOrEqual(120)
    expect(out.email.length).toBeLessThanOrEqual(254)
    expect(out.phone.length).toBeLessThanOrEqual(40)
    expect(out.address.length).toBeLessThanOrEqual(500)
  })

  it('handles a null body', () => {
    expect(readCustomerFields(null, 'a@b.com').email).toBe('a@b.com')
  })
})

describe('max quantity', () => {
  it('enforces the per-line quantity cap used by checkout and cart', () => {
    expect(MAX_QUANTITY_PER_LINE).toBe(99)
  })
})
