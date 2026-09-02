// =====================================================================
// Company & app info - GENUM SOLUTIONS
// =====================================================================

export const company = {
  name: 'GENUM SOLUTIONS PVT. LTD.',
  shortName: 'GENUM SOLUTIONS',
  url: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
  address: 'Shringhkhala Galli-32, Kathmandu, Nepal',
  city: 'Kathmandu',
  country: 'NP',
  email: 'genumsolutions@gmail.com',
  phone: '+977 9861842552',
  pan: '623676190',
  vatLabel: 'PAN registered',
  description: 'Robotics, electronics, 3D printing, AI, IoT, digital products, and practical technology training from Kathmandu, Nepal.',
}

// ---------------------------------------------------------------------------
// Dynamic app info - fetched from Supabase release.json manifest.
// ---------------------------------------------------------------------------
//
// The upload-release.mjs script (in the app repo) pushes a release.json to the
// Supabase "app-releases" public bucket on every new APK upload. This manifest
// contains: version, version_code, size_mb, file_name, and release notes.
//
// The bucket is configured as public (see website/supabase/schema.sql),
// so the website can read release.json directly via HTTP fetch.
// The androidApp object is synchronous - components read its properties
// directly. After uploading a new APK, call refreshAndroidAppInfo() to update
// the website without any code changes or redeployment.
//
// To make this work:
//   1. Build and release the new app APK (from mobile/ or C:\bs)
//   2. Run: node scripts/upload-release.mjs --apk releases/...
//   3. Call: import { refreshAndroidAppInfo } from '../lib/company'
//          await refreshAndroidAppInfo()
//   4. The website will instantly show the new version on /app.
export const androidApp: {
  version: string
  versionCode: number
  sizeLabel: string
  arch: string
  apkUrl: string
  releaseUrl: string
  appsPagePath: string
} = {
  // Default / fallback values (will be overwritten by refreshAndroidAppInfo()
  // once the release.json manifest is uploaded to the public Supabase bucket).
  version: '1.5.3',
  versionCode: 11,
  sizeLabel: '32.5 MB',
  arch: 'Android · 64-bit',
  apkUrl:
    'https://bkylfnlybtsujwzropru.supabase.co/storage/v1/object/public/app-releases/genum-solutions-latest.apk',
  releaseUrl:
    'https://bkylfnlybtsujwzropru.supabase.co/storage/v1/object/public/app-releases/release.json',
  appsPagePath: '/app',
}

// ---------------------------------------------------------------------------
// Refresh app info from Supabase release.json manifest.
// ---------------------------------------------------------------------------
// Call this after uploading a new APK via upload-release.mjs. The website will
// immediately reflect the new version on next page render.
// The Supabase app-releases bucket is public, so we can fetch release.json directly.
export async function refreshAndroidAppInfo(): Promise<{
  version: string
  versionCode: number
  sizeLabel: string
  arch: string
  apkUrl: string
  releaseUrl: string
  appsPagePath: string
}> {
  try {
    const releaseUrl =
      'https://bkylfnlybtsujwzropru.supabase.co/storage/v1/object/public/app-releases/release.json'
    // Cache-bust: CDN / browser may cache this file. Append a timestamp
    // so every mount gets the freshest manifest.
    const bust = `?_t=${Date.now()}`
    const res = await fetch(releaseUrl + bust, {
      headers: {
        Accept: 'application/json',
        'Cache-Control': 'no-cache',
      },
    })

    if (!res.ok) {
      // If release.json doesn't exist yet (e.g., first run or failed upload),
      // keep current androidApp values.
      throw new Error('release.json not found')
    }

    const manifest = await res.json()

    // Update androidApp with new manifest values.
    // Only overwrite fields that are actually present in the manifest so the
    // defaults (hardcoded above) are never wiped to empty/zero.
    if (manifest.version) androidApp.version = manifest.version
    if (manifest.version_code) androidApp.versionCode = manifest.version_code
    // Handle both old manifest format ({ size: "32.5 MB" }) and
    // new format ({ size_mb: 32.5 }).
    if (manifest.size_mb !== undefined && manifest.size_mb > 0) {
      androidApp.sizeLabel = `${Number(manifest.size_mb).toFixed(1)} MB`
    } else if (manifest.size && manifest.size !== '0') {
      androidApp.sizeLabel = manifest.size
    }
    if (manifest.apkUrl) androidApp.apkUrl = manifest.apkUrl
    if (manifest.releaseUrl) androidApp.releaseUrl = manifest.releaseUrl
    if (manifest.appsPagePath) androidApp.appsPagePath = manifest.appsPagePath

    // Dynamically compute the APK file size from the actual download URL
    // so the size is always accurate, even if the manifest doesn't include it.
    try {
      const head = await fetch(androidApp.apkUrl, { method: 'HEAD' })
      const length = head.headers.get('content-length')
      if (length) {
        const mb = Number(length) / (1024 * 1024)
        androidApp.sizeLabel = `${mb.toFixed(1)} MB`
      }
    } catch {
      // Size fetch failed — keep whatever we already have.
    }

    return androidApp
  } catch {
    // On failure (e.g., offline dev, release.json not yet uploaded) keep
    // the current androidApp values - no-op.
    return androidApp
  }
}