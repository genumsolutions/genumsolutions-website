import { describe, expect, it } from 'vitest'
import { initials } from '../lib/identity'
import { applyScope, filterProducts, formatNPR, paginate, type Product } from '../lib/catalog'
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

function makeProducts(count: number, category = 'Sensors'): Product[] {
  return Array.from({ length: count }, (_, i): Product => {
    const n = i + 1
    return {
      id: `p${n}`,
      name: `Product ${n}`,
      category,
      price: 100 * n,
      priceLabel: `NPR ${100 * n}`,
      sku: `SKU-${n}`,
      productType: 'Retail kit',
      note: `Note ${n}`,
      description: `Description ${n}`,
      specs: [],
      audience: 'Everyone',
      difficulty: 'Beginner',
      warranty: 'None',
      stock: 5,
      delivery: '1-2 days',
      color: 'from-white to-white',
    }
  })
}

describe('paginate', () => {
  it('returns the first page slice and reports hasMore', () => {
    const result = paginate(makeProducts(25), 1, 12)
    expect(result.items).toHaveLength(12)
    expect(result.page).toBe(1)
    expect(result.total).toBe(25)
    expect(result.totalPages).toBe(3)
    expect(result.hasMore).toBe(true)
  })

  it('returns the next page slice', () => {
    const result = paginate(makeProducts(25), 2, 12)
    expect(result.items).toHaveLength(12)
    expect(result.hasMore).toBe(true)
  })

  it('reports no more pages at the end', () => {
    const result = paginate(makeProducts(25), 3, 12)
    expect(result.items).toHaveLength(1)
    expect(result.hasMore).toBe(false)
  })

  it('clamps an out-of-range page to the last valid page', () => {
    const result = paginate(makeProducts(5), 99, 12)
    expect(result.page).toBe(1)
    expect(result.hasMore).toBe(false)
    expect(result.items).toHaveLength(5)
  })

  it('handles an empty list', () => {
    const result = paginate([], 1, 12)
    expect(result.items).toHaveLength(0)
    expect(result.totalPages).toBe(1)
    expect(result.hasMore).toBe(false)
  })
})

describe('filterProducts', () => {
  it('filters by category', () => {
    const list = [...makeProducts(3, 'Sensors'), ...makeProducts(2, 'Motors')]
    expect(filterProducts(list, 'Motors', '')).toHaveLength(2)
  })

  it('filters by free-text query across name, note and description', () => {
    const list = makeProducts(4)
    expect(filterProducts(list, 'All', 'note 2')).toHaveLength(1)
  })

  it('matches on product name', () => {
    const list = makeProducts(3)
    expect(filterProducts(list, 'All', 'product 3')).toHaveLength(1)
  })

  it('filters by category and query together', () => {
    const list = [...makeProducts(3, 'Sensors'), ...makeProducts(2, 'Motors')]
    expect(filterProducts(list, 'Motors', 'product 1')).toHaveLength(1)
  })
})

describe('applyScope', () => {
  const base = makeProducts(2)
  const base0 = base[0] as Product
  const car: Product = { ...base0, id: 'car', category: 'Robot Cars' }
  const kit: Product = { ...base0, id: 'kit', category: 'Pre-packaged Kits' }
  const project: Product = { ...base0, id: 'project', productType: 'Project package' }
  const all: Product[] = [...base, car, kit, project]

  it('filters to components (default) excluding cars, kits and project packages', () => {
    expect(applyScope(all, 'components').map((p) => p.id)).toEqual(['p1', 'p2'])
  })

  it('narrows to robot cars only', () => {
    expect(applyScope(all, 'cars').map((p) => p.id)).toEqual(['car'])
  })

  it('narrows to project packages only', () => {
    expect(applyScope(all, 'projects').map((p) => p.id)).toEqual(['project'])
  })
})

