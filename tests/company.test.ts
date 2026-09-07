import { describe, expect, it } from 'vitest'
import { appInfoFromManifest, sizeLabelFromManifest } from '../lib/company'

// The /app download section must show exactly what is actually downloadable.
// The live release.json manifest is the single source of truth — it is only
// written after a real APK upload — so the site never advertises a version
// whose build isn't ready yet.
describe('sizeLabelFromManifest', () => {
  it('derives the label from the exact size_bytes in decimal MB', () => {
    expect(sizeLabelFromManifest({ size_bytes: 37759954 })).toBe('37.8 MB')
  })

  it('prefers size_bytes over a stale/mismatched sizeLabel (matches real download)', () => {
    expect(sizeLabelFromManifest({ sizeLabel: '36 MB', size_mb: 36, size_bytes: 37759954 })).toBe('37.8 MB')
  })

  it('uses sizeLabel as a fallback when size_bytes is missing', () => {
    expect(sizeLabelFromManifest({ sizeLabel: '37.8 MB' })).toBe('37.8 MB')
  })

  it('formats size_mb to one decimal when size_bytes and sizeLabel are missing', () => {
    expect(sizeLabelFromManifest({ size_mb: 37.8 })).toBe('37.8 MB')
  })

  it('uses the legacy plain size string as a last resort', () => {
    expect(sizeLabelFromManifest({ size: '35.1 MB' })).toBe('35.1 MB')
  })

  it('ignores zero / empty sizes', () => {
    expect(sizeLabelFromManifest({ sizeLabel: '0' })).toBeUndefined()
    expect(sizeLabelFromManifest({ size_mb: 0 })).toBeUndefined()
    expect(sizeLabelFromManifest({ size_bytes: 0 })).toBeUndefined()
    expect(sizeLabelFromManifest({ size: '' })).toBeUndefined()
    expect(sizeLabelFromManifest({})).toBeUndefined()
  })
})

describe('appInfoFromManifest', () => {
  it('maps the manifest fields onto AppInfo', () => {
    const info = appInfoFromManifest({
      version: '1.6.3',
      version_code: 32,
      size_mb: 36,
      size_bytes: 37759954,
      apkUrl: 'https://bucket/genum-solutions-1.6.3.apk',
      latestApkUrl: 'https://bucket/genum-solutions-latest.apk',
      releaseUrl: 'https://bucket/release.json',
      appsPagePath: '/app',
    })
    expect(info).toEqual({
      version: '1.6.3',
      versionCode: 32,
      sizeLabel: '37.8 MB',
      apkUrl: 'https://bucket/genum-solutions-1.6.3.apk',
      latestApkUrl: 'https://bucket/genum-solutions-latest.apk',
      releaseUrl: 'https://bucket/release.json',
      appsPagePath: '/app',
    })
  })

  it('omits fields that are missing from the manifest', () => {
    expect(appInfoFromManifest({ version: '1.6.2' })).toEqual({ version: '1.6.2' })
  })

  it('ignores empty / non-numeric fields', () => {
    expect(appInfoFromManifest({ version: '', version_code: NaN, apkUrl: '' })).toEqual({})
  })
})