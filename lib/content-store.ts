import { products as localProducts, type Product } from './catalog'
import { roboModes as localRoBoModes, type RoboCarMode } from './robo-car-catalog'
import { createServiceClient, supabaseConfigured } from './supabase/server'

export type { Product } from './catalog'

export type SiteContent = {
  homeTitle: string
  homeBody: string
  products: Partial<Product>[]
}

const defaultContent: SiteContent = {
  homeTitle: 'Technology you can touch, test, and trust.',
  homeBody: 'Robotics kits, project solutions, fabrication, open tools, and training for curious builders, schools, and teams.',
  products: [],
}

type ProductRow = {
  id: string
  name: string
  category: string
  price: number
  price_label: string | null
  sku: string | null
  product_type: string | null
  note: string | null
  description: string | null
  specs: unknown
  audience: string | null
  difficulty: string | null
  warranty: string | null
  stock: number | null
  delivery: string | null
  color: string | null
  badge: string | null
  supplier: string | null
  image_url: string | null
}

function rowToProduct(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    price: row.price ?? 0,
    priceLabel: row.price_label || (row.price ? `NPR ${row.price.toLocaleString('en-IN')}` : 'Request quote'),
    sku: row.sku || '',
    productType: (row.product_type as Product['productType']) || 'Retail kit',
    note: row.note || '',
    description: row.description || '',
    specs: Array.isArray(row.specs) ? (row.specs as string[]) : [],
    audience: row.audience || '',
    difficulty: (row.difficulty as Product['difficulty']) || 'Beginner',
    warranty: row.warranty || '',
    stock: row.stock ?? 0,
    delivery: row.delivery || '',
    color: row.color || 'from-[#dce8ff] to-[#7e9ff2]',
    ...(row.badge ? { badge: row.badge } : {}),
    ...(row.supplier ? { supplier: row.supplier } : {}),
    ...(row.image_url ? { image: row.image_url } : {}),
  }
}

export function productToRow(product: Product) {
  return {
    id: product.id,
    name: product.name,
    category: product.category,
    price: Math.max(0, Math.round(Number(product.price) || 0)),
    price_label: product.priceLabel,
    sku: product.sku,
    product_type: product.productType,
    note: product.note,
    description: product.description,
    specs: product.specs,
    audience: product.audience,
    difficulty: product.difficulty,
    warranty: product.warranty,
    stock: Math.max(0, Math.round(Number(product.stock) || 0)),
    delivery: product.delivery,
    color: product.color,
    badge: product.badge || null,
    supplier: product.supplier || null,
    image_url: product.image || null,
    updated_at: new Date().toISOString(),
  }
}

// Reads the authoritative catalog. Falls back to the bundled catalog when Supabase
// is not configured or unreachable so the site never renders empty.
export async function getManagedProducts(): Promise<Product[]> {
  if (!supabaseConfigured()) return localProducts
  try {
    const db = createServiceClient()
    const { data, error } = await db.from('products').select('*').order('sort_order', { ascending: true }).order('name', { ascending: true })
    if (error) throw error
    if (!data || data.length === 0) return localProducts
    const localImageMap = new Map(localProducts.map((p) => [p.id, p.image]))
    return data.map((row) => {
      const product = rowToProduct(row)
      if (!product.image) {
        const localImg = localImageMap.get(row.id)
        if (localImg) product.image = localImg
      }
      return product
    })
  } catch (error) {
    console.error('Supabase product read failed; using local catalog.', error)
    return localProducts
  }
}

export async function saveProduct(product: Product) {
  await createServiceClient().from('products').upsert(productToRow(product))
}

export async function deleteProduct(id: string) {
  await createServiceClient().from('products').delete().eq('id', id)
}

export async function getSiteContent(): Promise<SiteContent> {
  if (!supabaseConfigured()) return defaultContent
  try {
    const { data, error } = await createServiceClient().from('site_content').select('*').eq('id', 1).maybeSingle()
    if (error || !data) return defaultContent
    return { homeTitle: data.home_title, homeBody: data.home_body, products: [] }
  } catch {
    return defaultContent
  }
}

export async function saveSiteContent(values: Pick<SiteContent, 'homeTitle' | 'homeBody'>) {
  await createServiceClient()
    .from('site_content')
    .update({ home_title: values.homeTitle, home_body: values.homeBody, updated_at: new Date().toISOString() })
    .eq('id', 1)
}

export type { RoboCarMode }

export const roboModes: RoboCarMode[] = localRoBoModes

export async function getManagedRoBoModes(): Promise<RoboCarMode[]> {
  if (!supabaseConfigured()) return localRoBoModes
  try {
    const db = createServiceClient()
    const { data, error } = await db.from('robo_car_modes').select('*').order('sort_order', { ascending: true }).order('name', { ascending: true })
    if (error) throw error
    if (!data || data.length === 0) return localRoBoModes
    return data as RoboCarMode[]
  } catch (error) {
    console.error('Supabase robo mode read failed; using local catalog.', error)
    return localRoBoModes
  }
}

export async function saveRoBoMode(mode: RoboCarMode) {
  await createServiceClient().from('robo_car_modes').upsert({
    id: mode.id,
    name: mode.name,
    token: mode.token,
    device_index: mode.deviceIndex,
    car: mode.car,
    wheel: mode.wheel,
    steering: mode.steering,
    sensors: mode.sensors,
    transport: mode.transport,
    remote_with: mode.remoteWith,
    controls: mode.controls,
    requires_connection: mode.requiresConnection,
    blurb: mode.blurb,
    sort_order: mode.sort_order ?? 1000,
    updated_at: new Date().toISOString(),
  })
}

export async function deleteRoBoMode(id: string) {
  await createServiceClient().from('robo_car_modes').delete().eq('id', id)
}
