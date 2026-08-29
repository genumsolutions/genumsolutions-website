import { NextRequest, NextResponse } from 'next/server'
import { getManagedProducts } from '../../../lib/content-store'
import { applyScope, filterProducts, paginate, PAGE_SIZE } from '../../../lib/catalog'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const products = await getManagedProducts()

    const params = request.nextUrl.searchParams

    // Pagination/filter mode (used by the catalog "See more" flow). An
    // unpaginated request keeps the legacy bare-array response so callers such
    // as checkout keep working unchanged.
    const wantsPagination =
      params.has('page') || params.has('limit') || params.has('q') || params.has('category') || params.has('scope')
    if (!wantsPagination) {
      const response = NextResponse.json(products)
      // Public read-only data - safe for browsers / the service worker to
      // cache stale-while-revalidate so the catalog works offline.
      response.headers.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=600')
      return response
    }

    const scope = params.get('scope') || 'components'
    const query = params.get('q') || ''
    const category = params.get('category') || 'All'
    const page = Math.max(1, Number(params.get('page') || 1))
    const limit = Math.min(50, Math.max(1, Number(params.get('limit') || PAGE_SIZE)))

    const scoped = applyScope(products, scope)
    const filtered = filterProducts(scoped, category, query)
    const { items, page: activePage, total, totalPages, hasMore } = paginate(filtered, page, limit)

    return NextResponse.json({ products: items, page: activePage, total, totalPages, hasMore })
  } catch (error) {
    console.error('Product list failed', error)
    return NextResponse.json({ error: 'Could not load products.' }, { status: 500 })
  }
}
