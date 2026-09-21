// =====================================================================
// generate-app-icons.mjs — rebuild the GENUM app's launcher/splash icon
// set from the company stamp logo (public/logo.png — the same stamp the
// website header uses), writing into ../genumsolutions-app/mobile/assets/.
//
// WHY: the app repo's assets/logo.png is byte-identical to the stamp,
// but every DERIVED asset the phone renders was old branding — the
// adaptive-icon foreground was ~95% transparent, icon.png a flat light
// square, splash-icon ~90% empty. Android launchers render the adaptive
// icon, so installed devices never showed the stamp. This regenerates:
//
//   icon.png                     1024×1024 full stamp (opaque)
//   android-icon-foreground.png  1024×1024 stamp chip on transparent
//   android-icon-background.png  1024×1024 solid stamp-paper color
//   android-icon-monochrome.png  432×432  ink silhouette (alpha mask)
//   splash-icon.png              1024×1024 full stamp (opaque)
//   favicon.png                  48×48    stamp
//
// Adaptive-icon design: the chip is a 62.5% centered square. Its paper
// corners blend into the background layer (sampled from the stamp's own
// paper), so every launcher mask — circle, squircle, square — shows the
// full stamp with no visible seams and nothing clipped.
//
// Run from genumsolutions-website:  node scripts/generate-app-icons.mjs
// (sharp lives in this repo's node_modules)
// =====================================================================
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const source = path.join(process.cwd(), 'public', 'logo.png')
const outDir = path.join(process.cwd(), '..', 'genumsolutions-app', 'mobile', 'assets')

if (!existsSync(source)) {
  console.error(`stamp logo not found: ${source}`)
  process.exit(1)
}
if (!existsSync(outDir)) {
  console.error(`app assets dir not found: ${outDir}`)
  process.exit(1)
}

const stamp = await readFile(source)
const meta = await sharp(stamp).metadata()
if (!meta.width || !meta.height) {
  console.error('could not read stamp dimensions')
  process.exit(1)
}

// Sample the stamp's paper color (top-left patch, averaged) for the
// adaptive background layer so foreground chip edges blend invisibly.
const { data: paper } = await sharp(stamp)
  .extract({ left: 8, top: 8, width: 24, height: 24 })
  .resize(1, 1)
  .raw()
  .toBuffer({ resolveWithObject: true })
const paperHex =
  '#' + [paper[0], paper[1], paper[2]].map((v) => v.toString(16).padStart(2, '0')).join('')
console.log(`stamp ${meta.width}x${meta.height} · paper ${paperHex}`)

// Inset crop trims any border/scan edge before deriving assets.
const inset = Math.round(Math.min(meta.width, meta.height) * 0.04)
const trimmed = sharp(stamp).extract({
  left: inset,
  top: inset,
  width: meta.width - inset * 2,
  height: meta.height - inset * 2,
})

const write = async (name, pipeline) => {
  const info = await pipeline.png().toFile(path.join(outDir, name))
  console.log(`assets/${name}  ${info.width}x${info.height}`)
}

// 1+5. Classic icon + splash: the full stamp on its own paper.
await write('icon.png', sharp(stamp).resize(1024, 1024))
await write('splash-icon.png', sharp(stamp).resize(1024, 1024).ensureAlpha())

// 2. Adaptive background: solid paper color, fully opaque.
await write(
  'android-icon-background.png',
  sharp({
    create: { width: 1024, height: 1024, channels: 4, background: paperHex },
  }),
)

// 3. Adaptive foreground: 62.5% centered chip on transparent canvas.
const CHIP = 640
const chipBuf = await trimmed.clone().resize(CHIP, CHIP).png().toBuffer()
await write(
  'android-icon-foreground.png',
  sharp({
    create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  }).composite([{ input: chipBuf, left: (1024 - CHIP) / 2, top: (1024 - CHIP) / 2 }]),
)

// 4. Monochrome (Android 13+ themed icons): the ink as an alpha mask.
// Ink is dark on light paper → negate the grayscale so ink→opaque white,
// then push the paper haze to 0 with a levels cut. Launchers tint it.
const MONO = 432
const { data: gray, info } = await trimmed
  .clone()
  .resize(MONO, MONO)
  .greyscale()
  .negate()
  .normalise()
  .raw()
  .toBuffer({ resolveWithObject: true })
const mono = Buffer.alloc(MONO * MONO * 4)
for (let i = 0; i < gray.length; i++) {
  const v = Math.max(0, Math.min(255, Math.round(gray[i] * 1.8 - 60)))
  mono[i * 4] = 255
  mono[i * 4 + 1] = 255
  mono[i * 4 + 2] = 255
  mono[i * 4 + 3] = v
}
await write('android-icon-monochrome.png', sharp(mono, { raw: { width: MONO, height: MONO, channels: 4 } }))

// 6. Favicon.
await write('favicon.png', sharp(stamp).resize(48, 48))

console.log('done — bump versionCode in app.json so devices actually rebuild the icon')
