import { describe, expect, it } from 'vitest'
import { isBundledNewer } from '../lib/company'

// The /app download section must always show the newest version that is
// actually downloadable. A stale release.json manifest (e.g. still v1.5.13
// after a v1.5.14 bump) must never downgrade the bundled fallback.
describe('isBundledNewer', () => {
  it('treats a higher version code as newer', () => {
    expect(isBundledNewer('1.5.14', 22, '1.5.13', 21)).toBe(true)
  })

  it('treats a lower version code as older', () => {
    expect(isBundledNewer('1.5.12', 20, '1.5.14', 22)).toBe(false)
  })

  it('falls back to semver when codes are equal', () => {
    // Same code, newer semver — bundled wins
    expect(isBundledNewer('1.5.14', 22, '1.5.13', 22)).toBe(true)
    // Same code, older semver — manifest wins
    expect(isBundledNewer('1.5.12', 22, '1.5.13', 22)).toBe(false)
  })

  it('uses semver when the manifest has no version_code (old format)', () => {
    expect(isBundledNewer('1.5.14', 22, '1.5.13', undefined)).toBe(true)
    expect(isBundledNewer('1.5.12', 22, '1.5.13', undefined)).toBe(false)
  })

  it('returns false for equal versions', () => {
    expect(isBundledNewer('1.5.14', 22, '1.5.14', 22)).toBe(false)
  })

  it('handles an empty/missing manifest version without throwing', () => {
    expect(isBundledNewer('1.5.14', 22, '', undefined)).toBe(true)
    expect(isBundledNewer('1.5.14', 22, undefined, undefined)).toBe(true)
  })
})