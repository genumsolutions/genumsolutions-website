import { promises as fs } from 'node:fs'
import path from 'node:path'
import { products as localProducts, type Product } from './catalog'

export type SiteContent = {
  homeTitle: string
  homeBody: string
  products: Partial<Product>[]
}

const contentPath = path.join(process.cwd(), 'data', 'admin-content.json')
const defaultContent: SiteContent = {
  homeTitle: 'Technology you can touch, test, and trust.',
  homeBody: 'Robotics kits, project solutions, fabrication, open tools, and training for curious builders, schools, and teams.',
  products: [],
}

async function readContent(): Promise<SiteContent> {
  try {
    const raw = await fs.readFile(contentPath, 'utf8')
    return { ...defaultContent, ...JSON.parse(raw) }
  } catch {
    return defaultContent
  }
}

async function writeContent(content: SiteContent) {
  await fs.mkdir(path.dirname(contentPath), { recursive: true })
  await fs.writeFile(contentPath, JSON.stringify(content, null, 2) + '\n', 'utf8')
}

export async function getSiteContent() {
  return readContent()
}

export async function getManagedProducts() {
  const content = await readContent()
  const overrides = new Map(content.products.map((product) => [product.id, product]))
  const managed = localProducts.map((product) => ({ ...product, ...(overrides.get(product.id) || {}) }))
  const localIds = new Set(localProducts.map((product) => product.id))
  return [...managed, ...content.products.filter((product) => product.id && !localIds.has(product.id))] as Product[]
}

export async function saveProduct(product: Product) {
  const content = await readContent()
  const nextProducts = content.products.filter((item) => item.id !== product.id)
  const localProduct = localProducts.find((item) => item.id === product.id)
  nextProducts.push(localProduct ? product : product)
  await writeContent({ ...content, products: nextProducts })
}

export async function saveSiteContent(values: Pick<SiteContent, 'homeTitle' | 'homeBody'>) {
  const content = await readContent()
  await writeContent({ ...content, ...values })
}
