import { products as localProducts } from './catalog'

const STRAPI_URL = process.env.NEXT_PUBLIC_STRAPI_URL

export async function getProducts() {
  if (!STRAPI_URL) return localProducts
  try {
    const response = await fetch(`${STRAPI_URL}/api/products?populate=*`, { next: { revalidate: 60 } })
    if (!response.ok) throw new Error('Strapi request failed')
    const payload = await response.json()
    return payload.data.map((item: any) => ({ id: item.id, ...item.attributes }))
  } catch {
    return localProducts
  }
}
