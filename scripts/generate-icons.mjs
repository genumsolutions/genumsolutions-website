import { mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const root = process.cwd()
const source = path.join(root, 'public', 'logo.png')
const outDir = path.join(root, 'public')

const targets = [
  { file: 'icon-32.png', size: 32 },
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  { file: 'apple-touch-icon.png', size: 180 },
]

await mkdir(outDir, { recursive: true })
const input = await readFile(source)

for (const { file, size } of targets) {
  await sharp(input)
    .resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .png()
    .toFile(path.join(outDir, file))
  console.log(`generated public/${file} (${size}x${size})`)
}
