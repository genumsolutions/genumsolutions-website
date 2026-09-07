import { describe, expect, it } from 'vitest'
import { appInfoFromManifest, sizeLabelFromManifest } from '../lib/company'

// The /app download section must show exactly what is actually downloadable.
// The live release.json manifest is the single source of truth — it is only
// written after a real APK upload — so the site never advertises a version
// whose build isn't ready yet.
describe('sizeLabelFromManifest', () => {
  it('uses the exact sizeLabel written by the uploader', () => {
    expect(sizeLabelFromManifest({ sizeLabel: '36 MB', size_mb: 36.0112 })).toBe('36 MB')
  })

  it('formats size_mb to one decimal when there is no sizeLabel', () => {
    expect(sizeLabelFromManifest({ size_mb: 36 })).toBe('36.0 MB')
  })

  it('uses the legacy plain size string as a last resort', () => {
    expect(sizeLabelFromManifest({ size: '35.1 MB' })).toBe('35.1 MB')
  })

  it('ignores zero / empty sizes', () => {
    expect(sizeLabelFromManifest({ sizeLabel: '0' })).toBeUndefined()
    expect(sizeLabelFromManifest({ size_mb: 0 })).toBeUndefined()
    expect(sizeLabelFromManifest({ size: '' })).toBeUndefined()
    expect(sizeLabelFromManifest({})).toBeUndefined()
  })
})

describe('appInfoFromManifest', () => {
  it('maps the manifest fields onto AppInfo', () => {
    const info = appInfoFromManifest({
      version: '1.6.2',
      version_code: 31,
      size_mb: 36,
      apkUrl: 'https://bucket/genum-solutions-1.6.2.apk',
      latestApkUrl: 'https://bucket/genum-solutions-latest.apk',
      releaseUrl: 'https://bucket/release.json',
      appsPagePath: '/app',
    })
    expect(info).toEqual({
      version: '1.6.2',
      versionCode: 31,
      sizeLabel: '36.0 MB',
      apkUrl: 'https://bucket/genum-solutions-1.6.2.apk',
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