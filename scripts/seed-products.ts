import { readFileSync } from 'node:fs'
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
  inventory_type: product.inventoryType ?? 'Catalog',
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

async function main() {
  console.log(`Seeding ${rows.length} products to ${url} ...`)
  let done = 0
  for (let index = 0; index < rows.length; index += 50) {
    const chunk = rows.slice(index, index + 50)
    const { error } = await db.from('products').upsert(chunk)
    if (error) {
      console.error(`Chunk ${index}-${index + chunk.length} failed:`, error.message)
      process.exit(1)
    }
    done += chunk.length
    console.log(`  ${done}/${rows.length}`)
  }

  const content = {
    home_title: 'Technology you can touch, test, and trust.',
    home_body: 'Robotics kits, project solutions, fabrication, open tools, and training for curious builders, schools, and teams.',
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
