// =====================================================================
// sync-app-fallback.mjs - sync the website's bundled androidApp fallback
// to the LAST RELEASED build, straight from the live release.json manifest.
//
// The manifest is only written by upload-release.mjs (app repo) AFTER an
// actual APK upload, so running this script right after a release makes the
// fallback truthful. It must never be run BEFORE an upload (the bundled
// fallback must not be bumped in advance — that's what used to make the
// website advertise versions whose APK isn't ready yet).
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
  if (!version || !versionCode) {
    console.error('Error: manifest is missing version / version_code fields:')
    console.error(JSON.stringify(manifest, null, 2))
    process.exit(1)
  }

  // Read the current company.ts file
  let src = readFileSync(companyPath, 'utf8')

  // Update the version, versionCode, and sizeLabel fields
  // These patterns match the exact format in company.ts
  const versionPattern = /version: '\d+\.\d+\.\d+'/
  const versionCodePattern = /versionCode: \d+,/
  const sizeLabelPattern = /sizeLabel: '[^']*/

  // Check if patterns exist before replacing
  if (!versionPattern.test(src)) {
    console.error(`Pattern 'version: X.X.X' not found in ${companyPath}`)
    process.exit(1)
  }
  if (!versionCodePattern.test(src)) {
    console.error(`Pattern 'versionCode: N,' not found in ${companyPath}`)
    process.exit(1)
  }
  // sizeLabel pattern may or may not be present; handle gracefully
  let sizeLabelExists = sizeLabelPattern.test(src)

  // Replace version
  src = src.replace(versionPattern, `version: '${version}',`)

  // Replace versionCode
  src = src.replace(versionCodePattern, `versionCode: ${versionCode},`)

  // Replace sizeLabel if it exists
  if (sizeLabelExists) {
    // Extract the new sizeLabel (use 34.5 MB as default if manifest doesn't have size info)
    const defaultSizeLabel = '34.5 MB'
    const newSizeLabel = typeof manifest.sizeLabel === 'string' && manifest.sizeLabel !== '' ? manifest.sizeLabel : defaultSizeLabel
    src = src.replace(sizeLabelPattern, `sizeLabel: '${newSizeLabel}',`)
  }

  // Check if anything actually changed
  const srcChanged = src !== readFileSync(companyPath, 'utf8')

  if (!srcChanged) {
    console.log('No changes needed - fallback already matches the live manifest.')
    console.log(`  ${version} (${versionCode})`)
    return
  }

  writeFileSync(companyPath, src, 'utf8')
  console.log(`lib/company.ts fallback synced to live release: ${version} (${versionCode})`)
  console.log('Commit + push this website change so future fallback use is accurate:')
  console.log('  git add lib/company.ts')
  console.log('  git commit -m "chore: sync app fallback to released v' + version + '"')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})