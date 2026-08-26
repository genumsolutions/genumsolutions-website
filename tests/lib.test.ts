import { describe, expect, it } from 'vitest'
import { initials } from '../lib/identity'
import { formatNPR } from '../lib/catalog'
import { checkRateLimit } from '../lib/rate-limit'

describe('initials', () => {
  it('returns two initials from a full name', () => {
    expect(initials('Aarya Sharma')).toBe('AS')
  })

  it('returns one initial for a single word', () => {
    expect(initials('Madan')).toBe('M')
  })

  it('derives initials from an email address', () => {
    expect(initials('aarya.sharma@example.com')).toBe('AS')
  })

  it('uppercases lowercase input', () => {
    expect(initials('aarya sharma')).toBe('AS')
  })

  it('falls back to ? for empty input', () => {
    expect(initials('')).toBe('?')
  })

  it('falls back to ? for whitespace-only input', () => {
    expect(initials('   ')).toBe('?')
  })
})

describe('formatNPR', () => {
  it('formats whole rupees with Indian digit grouping', () => {
    expect(formatNPR(2500)).toMatch(/^NPR 2,500$/)
  })

  it('formats large amounts', () => {
    expect(formatNPR(1250000)).toMatch(/NPR 12,50,000/)
  })

  it('formats zero', () => {
    expect(formatNPR(0)).toBe('NPR 0')
  })
})

describe('checkRateLimit', () => {
  it('allows requests under the limit', () => {
    const key = `test-allow-${Math.random()}`
    for (let i = 0; i < 3; i++) {
      expect(checkRateLimit(key, 5, 60_000).allowed).toBe(true)
    }
  })

  it('blocks requests over the limit and reports retry time', () => {
    const key = `test-block-${Math.random()}`
    for (let i = 0; i < 5; i++) checkRateLimit(key, 5, 60_000)
    const result = checkRateLimit(key, 5, 60_000)
    expect(result.allowed).toBe(false)
    expect(result.retryAfterSeconds).toBeGreaterThan(0)
    expect(result.retryAfterSeconds).toBeLessThanOrEqual(60)
  })

  it('tracks keys independently', () => {
    const keyA = `test-a-${Math.random()}`
    const keyB = `test-b-${Math.random()}`
    for (let i = 0; i < 5; i++) checkRateLimit(keyA, 5, 60_000)
    expect(checkRateLimit(keyA, 5, 60_000).allowed).toBe(false)
    expect(checkRateLimit(keyB, 5, 60_000).allowed).toBe(true)
  })
})
