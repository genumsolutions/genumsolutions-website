import { mkdir, writeFile, readFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const root = process.cwd()
const outDir = path.join(root, 'public', 'media', 'products')
const UA = { 'User-Agent': 'GenumSolutionsWebsite/1.0 (product catalog imagery; contact admin@genumsolutions.example)' }

// id -> ordered Commons search queries (first hit that is a bitmap wins)
const products = [
  { id: 'arduino-uno', queries: ['Arduino Uno R3 board', 'Arduino Uno'] },
  { id: 'esp32-dev-board', queries: ['ESP32 development board', 'ESP32 WROOM'] },
  { id: 'dc-geared-motor-pair', queries: ['Yellow DC gear motor TT', 'TT gear motor robot', 'geared DC motor yellow'] },
  { id: 'sg90-servo-pair', queries: ['SG90 servo', 'TowerPro SG90'] },
  { id: 'ultrasonic-sensor', queries: ['HC-SR04 ultrasonic sensor', 'HC-SR04'] },
  { id: 'sensor-starter-pack', queries: ['Arduino sensor kit', 'Arduino sensor shield pack', 'sensor module kit Arduino'] },
  { id: 'mpu6050-imu', queries: ['MPU-6050 module', 'MPU6050'] },
  { id: '18650-battery-pack', queries: ['18650 lithium battery', '18650 battery'] },
  { id: 'li-ion-charger', queries: ['TP4056 charger module', 'TP4056'] },
  { id: 'robot-wheel-set', queries: ['65mm robot wheel rubber', 'robot wheel 65mm', 'rubber wheel robot car'] },
  { id: 'chassis-fastener-pack', queries: ['robot car chassis acrylic', 'Arduino robot chassis kit', 'acrylic robot chassis'] },
  { id: 'dupont-jst-cable-pack', queries: ['Dupont wire jumper', 'breadboard jumper wire', 'Dupont cable'] },
  { id: 'soldering-tool-kit', queries: ['soldering iron station electronics', 'soldering workstation', 'soldering iron kit'] },
  { id: 'pla-filament', queries: ['PLA 3D printing filament', 'PLA filament spool', '3D printer filament PLA'] },
  { id: 'petg-filament', queries: ['PETG filament spool', 'filament spool 3D printer'] },
  { id: 'printer-care-kit', queries: ['3D printer nozzle maintenance', '3D printer nozzle'] },
  { id: 'arduino-mega', queries: ['Arduino Mega 2560', 'Arduino Mega'] },
  { id: 'arduino-nano', queries: ['Arduino Nano'] },
  { id: 'esp8266-board', queries: ['NodeMCU ESP8266 board', 'ESP8266 NodeMCU', 'ESP8266 development'] },
  { id: 'stm32-board', queries: ['STM32 Blue Pill board', 'STM32 development board'] },
  { id: 'raspberry-pi-board', queries: ['Raspberry Pi 4 Model B', 'Raspberry Pi 4'] },
  { id: 'l298n-motor-driver', queries: ['L298N motor driver module', 'L298N'] },
  { id: 'l298p-motor-driver', queries: ['L298P motor driver shield', 'L298 motor driver Arduino'] },
  { id: 'stepper-motor', queries: ['NEMA 17 stepper motor', 'stepper motor'] },
  { id: 'bldc-motor', queries: ['brushless DC motor outrunner', 'BLDC motor'] },
  { id: 'bo-motor', queries: ['BO gear motor yellow', 'TT gear motor 130', 'yellow gearbox motor'] },
  { id: 'hc06-bluetooth', queries: ['HC-06 Bluetooth module PCB', 'HC-06 bluetooth', 'HC-05 Bluetooth module'] },
  { id: 'oled-display-13', queries: ['OLED display 1.3 inch I2C', 'SH1106 OLED', 'OLED display SSD1306'] },
  { id: 'oled-display-09', queries: ['0.91 inch OLED display I2C', 'OLED 0.96 display module', 'SSD1306 OLED display'] },
  { id: 'lipo-battery-pack', queries: ['lithium polymer battery', 'LiPo battery'] },
  { id: 'dc-dc-converter', queries: ['LM2596 buck converter', 'DC DC buck converter'] },
  { id: 'battery-bms', queries: ['battery protection board BMS', 'BMS circuit board'] },
  { id: 'omni-wheel-set', queries: ['omni wheel robot', 'omniwheel'] },
  { id: 'caster-wheel', queries: ['ball caster robot', 'metal ball caster', 'mini ball caster wheel'] },
  { id: 'breadboard-jumper-set', queries: ['solderless breadboard', 'breadboard'] },
  { id: 'xt60-power-connectors', queries: ['XT60 connector yellow pair', 'XT60 power connector', 'XT60 battery connector'] },
  { id: 'multimeter', queries: ['digital multimeter', 'multimeter'] },
  { id: 'abs-filament', queries: ['ABS filament spool', 'filament spool'] },
]

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function commonsBitmapTitles(query) {
  const api = `https://commons.wikimedia.org/w/api.php?action=query&format=json&list=search&srnamespace=6&srlimit=8&srsearch=${encodeURIComponent(query)}`
  const res = await fetch(api, { headers: UA })
  if (!res.ok) throw new Error(`search HTTP ${res.status}`)
  const data = await res.json()
  const hits = data?.query?.search ?? []
  return hits.map((h) => h.title).filter((t) => /\.(jpe?g|png)$/i.test(t))
}

async function downloadCommons(title) {
  const file = encodeURIComponent(title.replace(/^File:/, ''))
  const url = `https://commons.wikimedia.org/wiki/Special:FilePath/${file}?width=1200`
  const res = await fetch(url, { headers: UA })
  if (!res.ok) throw new Error(`file HTTP ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length < 8000) throw new Error('image too small')
  return buf
}

async function fetchFromCommons(queries) {
  for (const query of queries) {
    try {
      const titles = await commonsBitmapTitles(query)
      for (const title of titles.slice(0, 3)) {
        try {
          const buf = await downloadCommons(title)
          return { buf, source: title }
        } catch {
          await sleep(150)
        }
      }
    } catch {
      await sleep(150)
    }
  }
  throw new Error('no Commons result')
}

async function main() {
  await mkdir(outDir, { recursive: true })
  const results = []
  for (const product of products) {
    const out = path.join(outDir, `${product.id}.jpg`)
    try {
      await readFile(out)
      results.push({ id: product.id, status: 'exists' })
      continue
    } catch {
      /* not fetched yet */
    }
    try {
      const { buf, source } = await fetchFromCommons(product.queries)
      await sharp(buf).resize(1200, 1200, { fit: 'inside', withoutEnlargement: true }).flatten({ background: '#ffffff' }).jpeg({ quality: 82 }).toFile(out)
      results.push({ id: product.id, status: 'ok', source })
    } catch (error) {
      results.push({ id: product.id, status: 'MISS', error: String(error.message || error) })
    }
    await sleep(300)
  }
  for (const r of results) {
    console.log(`${r.status === 'ok' ? 'OK  ' : r.status === 'exists' ? 'SKIP' : 'MISS'} ${r.id}${r.source ? `  <- ${r.source}` : r.error ? `  (${r.error})` : ''}`)
  }
  const misses = results.filter((r) => r.status === 'MISS').map((r) => r.id)
  console.log(`\n${results.filter((r) => r.status === 'ok').length} fetched, ${results.filter((r) => r.status === 'exists').length} existing, ${misses.length} missing`)
  if (misses.length) console.log(`misses: ${misses.join(', ')}`)
}

main()
