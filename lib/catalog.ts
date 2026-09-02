/**
 * Product catalog — shared types and utility functions.
 *
 * The actual product data lives in Supabase (served via getManagedProducts)
 * with a local fallback in `catalog-data.ts` for offline / seed purposes.
 */
import { localProducts } from './catalog-data'

export type Product = {
  id: string
  name: string
  category: string
  price: number
  priceLabel: string
  sku: string
  productType: 'Retail kit' | 'Project package' | 'Material' | 'Service package'
  inventoryType?: 'Inhouse' | 'Catalog' | 'Supplier'
  active?: boolean
  projectOverview?: string
  objectives?: string[]
  materialsRequired?: string[]
  learningOutcomes?: string[]
  buildSteps?: string[]
  controlMethods?: string[]
  prerequisites?: string[]
  deliverables?: string[]
  estimatedDuration?: string
  sourceFolder?: string
  documentationUrl?: string
  videoUrl?: string
  maintenanceNotes?: string
  note: string
  description: string
  specs: string[]
  audience: string
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced' | 'Professional'
  warranty: string
  stock: number
  delivery: string
  color: string
  badge?: string
  supplier?: string
  image?: string
}

/** Re-export local seed data for backward compatibility and seeding. */
export const products: Product[] = localProducts

export const formatNPR = (value: number) => `NPR ${value.toLocaleString('en-IN')}`
export const findProduct = (slug: string) => products.find((product) => product.id === slug)

export const PAGE_SIZE = 12

// Narrow a product list by catalog scope. "components" is everything except
// robot cars, pre-packaged kits and project packages; "cars" is robot cars
// only; "projects" is project packages only.
export function applyScope(all: Product[], scope: string): Product[] {
  if (scope === 'cars') return all.filter((p) => p.category === 'Robot Cars')
  if (scope === 'projects') return all.filter((p) => p.productType === 'Project package')
  return all.filter(
    (p) =>
      !['Robot Cars', 'Pre-packaged Kits'].includes(p.category) &&
      p.productType !== 'Project package',
  )
}

// Combine a category and a free-text query into a single filter predicate.
export function filterProducts(list: Product[], category: string, query: string): Product[] {
  const needle = query.trim().toLowerCase()
  return list.filter((p) => {
    if (category !== 'All' && p.category !== category) return false
    if (!needle) return true
    return `${p.name} ${p.note} ${p.description}`.toLowerCase().includes(needle)
  })
}

// Split a (already scoped + filtered) list into pages for the catalog.
export function paginate(list: Product[], page: number, pageSize = PAGE_SIZE) {
  const total = list.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(Math.max(1, page), totalPages)
  const start = (safePage - 1) * pageSize
  return { items: list.slice(start, start + pageSize), page: safePage, total, totalPages, hasMore: safePage < totalPages }
}
