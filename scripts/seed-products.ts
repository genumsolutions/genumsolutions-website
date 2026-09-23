import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { localProducts as products } from '../lib/catalog-data'

// Minimal .env.local loader so `npm run seed` works without extra dependencies.
function loadEnvFile() {
  try {
    const raw = readFileSync(join(process.cwd(), '.env.local'), 'utf8')
    for (const line of raw.split('\n')) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/)
      if (!match?.[1]) continue
      const key = match[1]
      const value = (match[2] || '').replace(/^["']|["']$/g, '')
      if (!process.env[key]) process.env[key] = value
    }
  } catch {
    // Fall back to already-set environment variables.
  }
}

loadEnvFile()

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Add them to .env.local first.')
  process.exit(1)
}

const storageBase = url.replace(/\/+$/, '')
const db = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

// Legacy seed rows used site-relative image paths (/media/products/*.jpg),
// which only the Next.js app can serve. The native app must never depend on
// the website, so re-seeding writes the absolute Supabase Storage URL instead
// (photos live in the public "product-images" bucket, same file name).
function storageImageUrl(image: string | null, bucketBase: string): string | null {
  if (!image) return null
  if (!image.startsWith('/')) return image
  const name = image.split('/').pop()
  if (!name) return null
  return `${bucketBase}/storage/v1/object/public/product-images/${name}`
}

const rows = products.map((product, index) => ({
  id: product.id,
  name: product.name,
  category: product.category,
  price: Math.max(0, Math.round(product.price || 0)),
  price_label: product.priceLabel,
  sku: product.sku,
  product_type: product.productType,
  inventory_type: product.inventoryType ?? 'Inhouse',
  active: product.active !== false,
  project_overview: product.projectOverview ?? '',
  objectives: product.objectives ?? [],
  materials_required: product.materialsRequired ?? [],
  learning_outcomes: product.learningOutcomes ?? [],
  build_steps: product.buildSteps ?? [],
  control_methods: product.controlMethods ?? [],
  prerequisites: product.prerequisites ?? [],
  deliverables: product.deliverables ?? [],
  estimated_duration: product.estimatedDuration ?? '',
  source_folder: product.sourceFolder ?? '',
  documentation_url: product.documentationUrl ?? '',
  video_url: product.videoUrl ?? '',
  maintenance_notes: product.maintenanceNotes ?? '',
  note: product.note,
  description: product.description,
  specs: product.specs,
  audience: product.audience,
  difficulty: product.difficulty,
  warranty: product.warranty,
  stock: Math.max(0, Math.round(product.stock || 0)),
  delivery: product.delivery,
  color: product.color,
  badge: product.badge ?? null,
  supplier: product.supplier ?? null,
  image_url: storageImageUrl(product.image ?? null, storageBase),
  sort_order: index,
}))

// Ensure every site-relative image referenced by the new catalog exists as an
// object in the public "product-images" bucket. Existing objects are reused;
// only missing files are uploaded (e.g. the shared placeholder PNG).
async function ensureBucketImages(): Promise<void> {
  const { data: existing } = await db.storage.from('product-images').list('', { limit: 1000 })
  const present = new Set((existing || []).map((o) => o.name))
  const wanted = new Set(
    products
      .map((p) => (p.image && p.image.startsWith('/') ? p.image.split('/').pop() : null))
      .filter((n): n is string => Boolean(n)),
  )
  for (const name of wanted) {
    if (present.has(name)) continue
    const abs = join(process.cwd(), 'public', 'media', 'products', name)
    if (!existsSync(abs)) {
      console.error(`  WARN: referenced image not found locally: ${name}`)
      continue
    }
    const body = readFileSync(abs)
    const { error } = await db.storage.from('product-images').upload(name, body, {
      contentType: name.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg',
      upsert: true,
    })
    if (error) {
      console.error(`  WARN: could not upload ${name}: ${error.message}`)
    } else {
      console.log(`  uploaded ${name}`)
    }
  }
}

async function main() {
  console.log(`Seeding ${rows.length} products to ${url} ...`)
  console.log('Ensuring product images are present in the bucket ...')
  await ensureBucketImages()

  // Replace catalog: remove every existing product row, then insert the new
  // catalog. No Foreign Key points back at products, and car_mode_id only
  // references robo_car_modes (kept intact), so the wipe is safe.
  const { error: wipeError } = await db.from('products').delete().neq('id', '')
  if (wipeError) {
    console.error('Wipe failed:', wipeError.message)
    process.exit(1)
  }
  console.log('  removed existing product rows')

  let done = 0
  for (let index = 0; index < rows.length; index += 50) {
    const chunk = rows.slice(index, index + 50)
    const { error } = await db.from('products').insert(chunk)
    if (error) {
      console.error(`Chunk ${index}-${index + chunk.length} failed:`, error.message)
      process.exit(1)
    }
    done += chunk.length
    console.log(`  ${done}/${rows.length}`)
  }

  const content = {
    id: 1,
    home_title: 'Technology you can touch, test, and trust.',
    home_body: 'Electronics and robotics components, project solutions, fabrication, open tools, and training for curious builders, schools, and teams.',
    updated_at: new Date().toISOString(),
  }
  const { error } = await db.from('site_content').upsert(content)
  if (error) {
    console.error('Site content seed failed:', error.message)
    process.exit(1)
  }
  console.log('Done. Products and homepage content are in Supabase.')
  // Do NOT process.exit(0) here: Node on Windows can crash with
  // "Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)" when exit() cuts
  // off an open socket right after the last write. End naturally instead.
}

main()