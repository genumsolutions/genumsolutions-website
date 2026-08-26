import { writeFile, readFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const root = process.cwd()
const outDir = path.join(root, 'public', 'media', 'products')
const UA = { 'User-Agent': 'GenumSolutionsWebsite/1.0' }

const replacements = [
  { id: 'robot-wheel-set', urls: [
    'https://commons.wikimedia.org/wiki/Special:FilePath/Robot_wheel.jpg?width=1200',
    'https://cdn-shop.adafruit.com/970x728/4484-00.jpg',
  ]},
  { id: 'dc-geared-motor-pair', urls: [
    'https://commons.wikimedia.org/wiki/Special:FilePath/Yellow%20geared%20DC%20motor.jpg?width=1200',
    'https://commons.wikimedia.org/wiki/Special:FilePath/TT_Motor.jpg?width=1200',
    'https://cdn-shop.adafruit.com/970x728/4484-00.jpg',
  ]},
  { id: 'hc06-bluetooth', urls: [
    'https://commons.wikimedia.org/wiki/Special:FilePath/HC-06_bluetooth_module.jpg?width=1200',
    'https://cdn-shop.adafruit.com/970x728/260-03.jpg',
  ]},
  { id: 'bo-motor', urls: [
    'https://commons.wikimedia.org/wiki/Special:FilePath/Yellow%20geared%20DC%20motor.jpg?width=1200',
    'https://commons.wikimedia.org/wiki/Special:FilePath/TT_Motor.jpg?width=1200',
    'https://cdn-shop.adafruit.com/970x728/4484-00.jpg',
  ]},
  { id: 'dupont-jst-cable-pack', urls: [
    'https://cdn-shop.adafruit.com/970x728/1955-00.jpg',
  ]},
  { id: 'chassis-fastener-pack', urls: [
    'https://cdn-shop.adafruit.com/970x728/2881-00.jpg',
  ]},
  { id: 'l298p-motor-driver', urls: [
    'https://cdn-shop.adafruit.com/970x728/808-00.jpg',
  ]},
  { id: 'oled-display-09', urls: [
    'https://cdn-shop.adafruit.com/970x728/326-03.jpg',
  ]},
  { id: 'xt60-power-connectors', urls: [
    'https://cdn-shop.adafruit.com/970x728/2192-00.jpg',
  ]},
]

for (const { id, urls } of replacements) {
  const out = path.join(outDir, `${id}.jpg`)
  let success = false
  for (const url of urls) {
    try {
      console.log(`Trying ${id} <- ${url}`)
      const res = await fetch(url, { headers: UA, redirect: 'follow' })
      if (!res.ok) { console.log(`  HTTP ${res.status}`); continue }
      const buf = Buffer.from(await res.arrayBuffer())
      if (buf.length < 5000) { console.log(`  Too small (${buf.length} bytes)`); continue }
      await sharp(buf).resize(1200, 1200, { fit: 'inside', withoutEnlargement: true }).flatten({ background: '#ffffff' }).jpeg({ quality: 82 }).toFile(out)
      console.log(`OK ${id} <- ${url} (${buf.length} bytes)`)
      success = true
      break
    } catch (e) { console.log(`FAIL ${id} ${url}: ${e.message}`) }
  }
  if (!success) console.log(`MISS ${id}`)
}
