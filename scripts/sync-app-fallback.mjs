// =====================================================================
// sync-app-fallback.mjs - sync the website's bundled androidApp fallback
// to the LAST RELEASED build, straight from the live release.json manifest.
//
// The manifest is only written by upload-release.mjs (app repo) AFTER an
// actual APK upload, so running this script right after a release makes the
// fallback truthful. It must never be run BEFORE an upload (the bundled
// fallback must not be bumped in advance — that's what used to make the
// website advertise versions whose APK wasn't ready yet).
//
// Usage (from this website repo, AFTER an upload):
//   node scripts/sync-app-fallback.mjs
// Then commit + push the website change (version/size/APK url).
// =====================================================================
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const companyPath = resolve(rootDir, 'lib/company.ts')
const RELEASE_URL =
  'https://bkylfnlybtsujwzropru.supabase.co/storage/v1/object/public/app-releases/release.json'
const BUCKET_BASE = 'https://bkylfnlybtsujwzropru.supabase.co/storage/v1/object/public/app-releases'

function sizeLabelFromManifest(manifest) {
  if (typeof manifest.sizeLabel === 'string' && manifest.sizeLabel !== '0') return manifest.sizeLabel
  if (typeof manifest.size_mb === 'number' && manifest.size_mb > 0) {
    return `${Number(manifest.size_mb).toFixed(1)} MB`
  }
  if (typeof manifest.size === 'string' && manifest.size !== '0') return manifest.size
  return undefined
}

async function main() {
  let manifest
  try {
    const res = await fetch(`${RELEASE_URL}?_t=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    manifest = await res.json()
  } catch (err) {
    console.error(`Error: could not fetch ${RELEASE_URL} (${err.message}).`)
    console.error('No manifest = no upload yet. Run this AFTER a release upload.')
    process.exit(1)
  }

  const version = typeof manifest.version === 'string' ? manifest.version : null
  const versionCode =
    typeof manifest.version_code === 'number' && Number.isFinite(manifest.version_code)
      ? manifest.version_code
      : null
  const sizeLabel = sizeLabelFromManifest(manifest)
  if (!version || !versionCode || !sizeLabel) {
    console.error('Error: manifest is missing version / version_code / size fields:')
    console.error(JSON.stringify(manifest, null, 2))
    process.exit(1)
  }

  const manifestApkUrl = typeof manifest.apkUrl === 'string' ? manifest.apkUrl : null
  const apkUrl =
    manifestApkUrl ||
    `${BUCKET_BASE}/genum-solutions-${version}.apk`

  const src = readFileSync(companyPath, 'utf8')

  const replacements = [
    [/version: '\d+\.\d+\.\d+',/, `version: '${version}',`],
    [/versionCode: \d+,/, `versionCode: ${versionCode},`],
    [/sizeLabel: '[^']*',/, `sizeLabel: '${sizeLabel}',`],
    [/genum-solutions-\d+\.\d+\.\d+\.apk/, apkUrl.split('/').pop()],
  ]
  let out = src
  let changed = false
  for (const [pattern, replacement] of replacements) {
    if (!pattern.test(out)) {
      console.error(`Pattern not found in ${companyPath}: ${pattern}`)
      process.exit(1)
    }
    const next = out.replace(pattern, replacement)
    if (next !== out) changed = true
    out = next
  }

  if (!changed) {
    console.log('No changes needed - fallback already matches the live manifest.')
    console.log(`  ${version} (${versionCode}) · ${sizeLabel}`)
    return
  }

  writeFileSync(companyPath, out, 'utf8')
  console.log(`lib/company.ts fallback synced to live release: ${version} (${versionCode}) · ${sizeLabel}`)
  console.log('Commit + push this website change so future fallback use is accurate:')
  console.log('  git add lib/company.ts')
  console.log('  git commit -m "chore: sync app fallback to released v' + version + '"')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})