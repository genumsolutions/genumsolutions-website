// =====================================================================
// Company & app info - GENUM SOLUTIONS
//
// `company` is the bundled DEFAULT / fallback identity (and the seed
// source for the `company_info` table). The DB-first read lives in
// lib/company-store.ts (getCompany) - surfaces that show business contact
// details should read through it so edits made in the DB show everywhere.
// =====================================================================

export type Company = {
  name: string
  shortName: string
  url: string
  address: string
  city: string
  country: string
  email: string
  phone: string
  pan: string
  vatLabel: string
  description: string
}

export const company: Company = {
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
// Dynamic app info - the live Supabase release.json manifest is the SINGLE
// source of truth for what /app shows. The manifest is only written when a
// release actually uploads (upload-release.mjs in the app repo), so the site
// never advertises a version whose APK isn't ready yet.
// ---------------------------------------------------------------------------

export type AppInfo = {
  version: string
  versionCode: number
  sizeLabel: string
  arch: string
  apkUrl: string
  latestApkUrl: string
  releaseUrl: string
  appsPagePath: string
  /** What changed in the latest publish ("OTA · …" for short updates). */
  notes?: string
  /** Last-published ISO timestamp from release.json. */
  updatedAt?: string
}

// Bundled fallback used ONLY when the manifest is unreachable (offline dev,
// first deploy, bucket outage). It reflects the LAST RELEASED build — it is
// never bumped in advance of a release. Keep it in sync after an upload with:
//   node scripts/sync-app-fallback.mjs
// (in this repo). bump-version.mjs in the app repo no longer touches this file.
export const androidApp: AppInfo = {
  version: '2.0.4',
  versionCode: 47,
  sizeLabel: '41.3 MB',
  arch: 'Android · 64-bit',  apkUrl: 'https://bkylfnlybtsujwzropru.supabase.co/storage/v1/object/public/app-releases/genum-solutions-2.0.4.apk',
  latestApkUrl: 'https://bkylfnlybtsujwzropru.supabase.co/storage/v1/object/public/app-releases/genum-solutions-latest.apk',
  releaseUrl:
    'https://bkylfnlybtsujwzropru.supabase.co/storage/v1/object/public/app-releases/release.json',
  appsPagePath: '/app',
}

const RELEASE_URL =
  'https://bkylfnlybtsujwzropru.supabase.co/storage/v1/object/public/app-releases/release.json'

async function fetchReleaseManifest(): Promise<Record<string, unknown> | null> {
  try {
    // Cache-bust: CDN / browser may cache this file. Append a timestamp +
    // no-store so every call gets the freshest manifest.
    const bust = `?_t=${Date.now()}`
    const res = await fetch(RELEASE_URL + bust, {
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        'Cache-Control': 'no-cache',
      },
    })
    if (!res.ok) return null
    return (await res.json()) as Record<string, unknown>
  } catch {
    return null
  }
}

/**
 * Derive the human-readable size label from a manifest. Order of preference:
 * 1. size_bytes (exact, authoritative) -> formatted in DECIMAL MB ("37.8 MB")
 * 2. sizeLabel (uploader string, already decimal)
 * 3. size_mb (formatted to one decimal)
 * 4. size (legacy plain string)
 *
 * Decimal MB (39 MB = 39,000,000 bytes) matches what download managers, web
 * browsers, Google Play and Android file explorers report, so the label shown
 * on the site equals the size of the file after download. Zeros/empty strings
 * are treated as "not present" — the manifest is written by the uploader from
 * real bytes, so a real manifest always has a real size.
 */
export function sizeLabelFromManifest(manifest: Record<string, unknown>): string | undefined {
  if (typeof manifest.size_bytes === 'number' && Number.isFinite(manifest.size_bytes) && manifest.size_bytes > 0) {
    return `${(manifest.size_bytes / 1_000_000).toFixed(1)} MB`
  }
  if (typeof manifest.sizeLabel === 'string' && manifest.sizeLabel !== '0') {
    return manifest.sizeLabel
  }
  if (typeof manifest.size_mb === 'number' && manifest.size_mb > 0) {
    return `${Number(manifest.size_mb).toFixed(1)} MB`
  }
  if (typeof manifest.size === 'string' && manifest.size && manifest.size !== '0') {
    return manifest.size
  }
  return undefined
}

/**
 * Map a release.json manifest onto AppInfo fields. Only fields actually present
 * in the manifest are set, so nothing is wiped to empty/zero.
 */
export function appInfoFromManifest(manifest: Record<string, unknown>): Partial<AppInfo> {
  const info: Partial<AppInfo> = {}
  if (typeof manifest.version === 'string' && manifest.version) info.version = manifest.version
  if (typeof manifest.version_code === 'number' && Number.isFinite(manifest.version_code)) {
    info.versionCode = manifest.version_code
  }
  const sizeLabel = sizeLabelFromManifest(manifest)
  if (sizeLabel) info.sizeLabel = sizeLabel
  if (typeof manifest.apkUrl === 'string' && manifest.apkUrl) info.apkUrl = manifest.apkUrl
  if (typeof manifest.latestApkUrl === 'string' && manifest.latestApkUrl) {
    info.latestApkUrl = manifest.latestApkUrl
  }
  if (typeof manifest.releaseUrl === 'string' && manifest.releaseUrl) {
    info.releaseUrl = manifest.releaseUrl
  }
  if (typeof manifest.appsPagePath === 'string' && manifest.appsPagePath) {
    info.appsPagePath = manifest.appsPagePath
  }
  // Human-facing metadata (optional). Present on every real manifest; absent
  // on the bundled fallback so nothing is wiped to empty in dev/offline.
  if (typeof manifest.notes === 'string' && manifest.notes) info.notes = manifest.notes
  if (typeof manifest.updated_at === 'string' && manifest.updated_at) {
    info.updatedAt = manifest.updated_at
  }
  return info
}

/**
 * The live app info: the release.json manifest merged over the bundled
 * fallback. The manifest is authoritative — it only exists after a real
 * upload — so the download section shows exactly what is downloadable.
 * Falls back to the bundled last-released values when the manifest is
 * unreachable. Non-mutating; safe to call from server components.
 */
export async function getLiveAppInfo(): Promise<AppInfo> {
  const manifest = await fetchReleaseManifest()
  if (!manifest) return { ...androidApp }
  return {
    ...androidApp,
    ...appInfoFromManifest(manifest),
  }
}

/**
 * Legacy refresh helper (kept for compatibility). Fetches the manifest and
 * mutates the module-level `androidApp` so existing consumers pick up the
 * live values. Fails silently to the bundled fallback when unreachable.
 */
export async function refreshAndroidAppInfo(): Promise<AppInfo> {
  const live = await getLiveAppInfo()
  Object.assign(androidApp, live)
  return live
}