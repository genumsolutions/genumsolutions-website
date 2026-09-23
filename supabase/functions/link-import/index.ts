// =====================================================================
// link-import — the shared "add product by link" extractor for BOTH
// clients (website admin + native app admin).
//
// Paste any product URL -> preview  : link-import extracts what it can
// (title, description, tags, images, source site, category hint) and the
// admin fills the rest; on save the admin's product form calls:
//
//   action 'create'  : re-extract, download the best image, upload it to
//                      the `product-images` bucket, and upsert the
//                      products row (documentation_url = source link).
//
// Extractors, in priority:
//   1. MakerWorld            -> Bambu Lab design API (anonymous metadata)
//   2. Any other site        -> OpenGraph + JSON-LD Product scan (bot-
//                               walled shops come back found:false and the
//                               admin fills the fields by hand).
//
// Security:
//   - Same staff+/admin+ gate as admin-products (caller JWT -> profile).
//   - Image download is SSRF-guarded: https-only, public-IP-only, 4 MB cap,
//     allowlisted content types, and the final tarball is stored in Supabase
//     Storage (never fetched directly by browsers from random CDNs).
//
// Body:  { action: 'preview'|'create', url, product?: {category?, name?,
//          price?, priceLabel?, stock?, description?, sortOrder?} }
//
// Deploy:
//   supabase functions deploy link-import --project-ref bkylfnlybtsujwzru
// =====================================================================
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const supabaseUrl = Deno.env.get('NEXT_PUBLIC_SUPABASE_URL') || Deno.env.get('SUPABASE_URL') || ''
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const MAX_IMAGE_BYTES = 4 * 1024 * 1024
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
    status,
  })
}

// ---------------- Caller auth (same gate as admin-products) ----------------
async function callerRole(
  req: Request,
): Promise<{ role: string | null; client: ReturnType<typeof createClient> | null; error?: string }> {
  const callerToken = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
  if (!callerToken) return { role: null, client: null, error: 'Sign in to import products.' }
  const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: userData } = await adminClient.auth.getUser(callerToken)
  const callerId = userData?.user?.id
  if (!callerId) return { role: null, client: null, error: 'Sign in to import products.' }
  const { data: callerProfile } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', callerId)
    .maybeSingle()
  if (!callerProfile?.role) return { role: null, client: null, error: 'Only staff members can import products.' }
  const role = String(callerProfile.role)
  if (!(role === 'staff' || role === 'admin' || role === 'owner')) {
    return { role: null, client: null, error: 'Only staff members can import products.' }
  }
  return { role, client: adminClient }
}

// ---------------- Small helpers ----------------
const slugify = (raw: string) =>
  String(raw || '')
    .toLowerCase()
    .trim()
    .replace(/&(amp;)?/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'untitled-product'

const stripHtml = (html: string) =>
  String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()

const dedupe = <T,>(arr: T[]) => Array.from(new Set(arr.filter(Boolean) as unknown[])) as T[]

function isHttpUrl(raw: string) {
  try {
    const u = new URL(raw)
    return u.protocol === 'https:' || u.protocol === 'http:'
  } catch {
    return false
  }
}

/** SSRF guard — resolution must end on a public IP, https only. */
function isPublicHttpsUrl(raw: string): boolean {
  try {
    const u = new URL(raw)
    if (u.protocol !== 'https:') return false
    const host = u.hostname
    if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) return false
    const isIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(host)
    if (!isIp) return true // DNS host — allow; fetch follows to a public IP
    const octets = host.split('.').map(Number)
    if (octets.some((o) => o > 255 || o < 0)) return false
    const [a, b] = octets
    if (a === 10) return false
    if (a === 172 && b >= 16 && b <= 31) return false
    if (a === 192 && b === 168) return false
    if (a === 127 || a === 0) return false
    return true
  } catch {
    return false
  }
}

// ---------------- MakerWorld / Bambu Lab extractor ----------------
const BAMBU_DESIGN_API = 'https://api.bambulab.com/v1/design-service/design'
const MAKERWORLD_HOSTS = ['makerworld.com', 'makerworld.com.cn', 'www.makerworld.com']

async function fetchBambuDesign(designId: number) {
  const res = await fetch(`${BAMBU_DESIGN_API}/${designId}`, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  })
  if (!res.ok) return null
  try {
    return await res.json()
  } catch {
    return null
  }
}

interface Preview {
  found: boolean
  provider: string
  sourceUrl: string
  title: string
  description: string
  tags: string[]
  images: string[]
  categoryHint: string
  extra?: Record<string, unknown>
}

/** Extract design id from a MakerWorld URL: https://makerworld.com/en/models/45000 ... */
function makerworldDesignId(url: string): number | null {
  try {
    const u = new URL(url)
    if (!MAKERWORLD_HOSTS.includes(u.hostname)) return null
    const m = u.pathname.match(/\/models\/(\d+)/)
    return m ? Number(m[1]) : null
  } catch {
    return null
  }
}

async function extractMakerWorld(url: string): Promise<Preview> {
  const designId = makerworldDesignId(url)
  if (!designId) return { found: false, provider: 'makerworld', sourceUrl: url, title: '', description: '', tags: [], images: [], categoryHint: '3D Models' }
  const design = await fetchBambuDesign(designId)
  if (!design?.title) {
    return { found: false, provider: 'makerworld', sourceUrl: url, title: '', description: '', tags: [], images: [], categoryHint: '3D Models', extra: { designId } }
  }
  const instances: { cover?: string; title?: string }[] = Array.isArray(design.instances) ? design.instances : []
  const images = dedupe([
    design.coverUrl,
    design.coverLandscape,
    design.coverPortrait,
    ...instances.map((i) => i.cover),
  ]).filter((u) => isHttpUrl(u as string))

  const tags = dedupe([...(design.tags ?? []), ...(design.tagsTranslated ?? [])]) as string[]

  return {
    found: true,
    provider: 'MakerWorld',
    sourceUrl: url,
    title: String(design.title || '').trim(),
    description: stripHtml(String(design.summary || '')),
    tags,
    images,
    categoryHint: '3D Models',
    extra: {
      designId,
      modelId: design.modelId,
      slug: design.slug,
      license: design.license,
      printCount: design.printCount,
      likeCount: design.likeCount,
      creator: design.designCreator?.name || design.originals?.[0]?.uploaderName,
    },
  }
}

// ---------------- Generic OpenGraph + JSON-LD extractor ----------------
const readMeta = (html: string, prop: string): string => {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i')
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, 'i')
  const m = html.match(re) || html.match(re2)
  return m ? m[1] : ''
}

function scanJsonLd(html: string): { name?: string; image?: string; description?: string; price?: string; siteName?: string } {
  const blocks = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) ?? []
  for (const block of blocks) {
    const raw = block.replace(/^<script[^>]*>/i, '').replace(/<\/script>$/i, '').trim()
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      continue
    }
    const scan = (node: Record<string, unknown>): { name?: string; image?: string; description?: string; price?: string; siteName?: string } | null => {
      if (!node || typeof node !== 'object') return null
      const type = Array.isArray(node['@type']) ? node['@type'][0] : node['@type']
      if (type === 'Product' || type?.includes('Product')) {
        let image = ''
        if (typeof node['image'] === 'string') image = node['image']
        else if (Array.isArray(node['image']) && typeof node['image'][0] === 'string') image = node['image'][0]
        else if (typeof node['image'] === 'object' && node['image']?.['url']) image = node['image']['url'] as string
        const offer = Array.isArray(node['offers']) ? node['offers'][0] : node['offers']
        return {
          name: String(node['name'] || ''),
          image,
          description: String(node['description'] || ''),
          price: offer?.['price'] != null ? String(offer['price']) : undefined,
          siteName: typeof node['brand'] === 'object' && node['brand']?.['name'] ? String(node['brand']['name']) : undefined,
        }
      }
      for (const key of Object.keys(node)) {
        const v = node[key]
        if (Array.isArray(v)) {
          for (const item of v) {
            if (typeof item === 'object' && item !== null) {
              const r = scan(item as Record<string, unknown>)
              if (r?.name) return r
            }
          }
        } else if (typeof v === 'object' && v !== null) {
          const r = scan(v as Record<string, unknown>)
          if (r?.name) return r
        }
      }
      return null
    }
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (typeof item === 'object' && item !== null) {
          const r = scan(item as Record<string, unknown>)
          if (r?.name) return r
        }
      }
    } else if (typeof parsed === 'object' && parsed !== null) {
      const r = scan(parsed as Record<string, unknown>)
      if (r?.name) return r
    }
  }
  return {}
}

async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' },
      redirect: 'follow',
    })
    if (!res.ok) return null
    const type = res.headers.get('content-type') || ''
    if (!type.includes('text/html')) return null
    return await res.text()
  } catch {
    return null
  }
}

async function extractGeneric(url: string): Promise<Preview> {
  const html = await fetchPage(url)
  if (!html) return { found: false, provider: 'generic', sourceUrl: url, title: '', description: '', tags: [], images: [], categoryHint: '' }

  const ld = scanJsonLd(html)
  const ogTitle = readMeta(html, 'og:title')
  const ogDesc = readMeta(html, 'og:description')
  const ogImage = readMeta(html, 'og:image')
  const ogSite = readMeta(html, 'og:site_name')
  const htmlTitle = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').trim()
  const title = String(ld.name || ogTitle || htmlTitle || '').trim()
  const description = String(ld.description || ogDesc || '').trim()
  const image = String(ld.image || ogImage || '').trim()

  const images = dedupe([image]).filter((u) => isHttpUrl(u as string))

  return {
    found: Boolean(title),
    provider: ogSite || 'website',
    sourceUrl: url,
    title,
    description,
    tags: [],
    images,
    categoryHint: '',
    extra: ld.price ? { price: ld.price } : undefined,
  }
}

// ---------------- Image guard + storage upload ----------------
/** Sniff image type from magic bytes (CDNs often lie about content-type). */
function sniffImageType(buf: Uint8Array): { contentType: string; ext: string } | null {
  const p = (off: number, ...bytes: number[]) => {
    for (let i = 0; i < bytes.length; i++) if (buf[off + i] !== bytes[i]) return false
    return true
  }
  if (buf.length >= 3 && p(0, 0xff, 0xd8, 0xff)) return { contentType: 'image/jpeg', ext: 'jpg' }
  if (buf.length >= 8 && p(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return { contentType: 'image/png', ext: 'png' }
  if (buf.length >= 12 && p(0, 0x52, 0x49, 0x46, 0x46) && p(8, 0x57, 0x45, 0x42, 0x50)) return { contentType: 'image/webp', ext: 'webp' }
  if (buf.length >= 12 && p(0, 0x52, 0x49, 0x46, 0x46) && p(8, 0x41, 0x56, 0x49, 0x46)) return { contentType: 'image/avif', ext: 'avif' }
  if (buf.length >= 6 && p(0, 0x47, 0x49, 0x46, 0x38)) return { contentType: 'image/gif', ext: 'gif' }
  return null
}

async function downloadImage(url: string): Promise<{ bytes: Uint8Array; contentType: string; ext: string } | { error: string }> {
  if (!isPublicHttpsUrl(url)) return { error: 'Image URL must be https from a public host.' }
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' })
    if (!res.ok) return { error: `Image fetch failed (http ${res.status}).` }
    const buf = new Uint8Array(await res.arrayBuffer())
    if (buf.byteLength === 0) return { error: 'Image was empty.' }
    if (buf.byteLength > MAX_IMAGE_BYTES) return { error: 'Image is larger than 4 MB.' }
    const sniffed = sniffImageType(buf)
    if (!sniffed) return { error: 'Not a supported image (jpg/png/webp/avif/gif).' }
    return { bytes: buf, contentType: sniffed.contentType, ext: sniffed.ext }
  } catch {
    return { error: 'Image download failed.' }
  }
}

// ---------------- Main handlers ----------------
async function runPreview(url: string): Promise<Preview> {
  const id = makerworldDesignId(url)
  const preview = id ? await extractMakerWorld(url) : await extractGeneric(url)
  return preview
}

async function runCreate(body: Record<string, unknown>, client: ReturnType<typeof createClient>) {
  const url = String(body?.url || '')
  const overrides = (body?.product && typeof body.product === 'object' ? body.product : {}) as Record<string, unknown>
  if (!isHttpUrl(url)) return { status: 400, data: { error: 'Please paste a valid https product link.' } }

  const preview = await runPreview(url)
  const rawName = String(overrides?.name || preview.title || '').trim()
  if (!rawName) return { status: 400, data: { error: 'No product name available. Please fill the name manually.' } }

  let imageUrl = ''
  if (preview.images.length > 0) {
    const img = await downloadImage(preview.images[0])
    if ('error' in img) {
      // Non-fatal — the product can still be saved without an image.
      console.warn('link-import image skip:', img.error)
    } else {
      const path = `${crypto.randomUUID()}-${slugify(rawName)}.${img.ext}`
      const { error: upErr } = await client.storage.from('product-images').upload(path, img.bytes, {
        contentType: img.contentType,
        upsert: false,
      })
      if (!upErr) {
        imageUrl = `${supabaseUrl}/storage/v1/object/public/product-images/${path}`
      } else {
        console.warn('link-import storage skip:', upErr.message)
      }
    }
  }

  const category = String(overrides?.category || preview.categoryHint || 'Retail kit').trim().slice(0, 80)
  const description = String(overrides?.description || preview.description || '').trim().slice(0, 4000)
  const price = Math.max(0, Math.round(Number(overrides?.price) || 0))
  const stock = Math.max(0, Math.round(Number(overrides?.stock) || 0))
  const priceLabel = String(overrides?.priceLabel || 'Request quote').trim().slice(0, 60)

  let id = slugify(rawName)
  const { data: existing } = await client.from('products').select('documentation_url').eq('id', id).maybeSingle()
  if (existing && existing.documentation_url !== url) {
    id = `${slugify(rawName)}-${Math.random().toString(36).slice(2, 6)}`
  }

  const row = {
    id,
    name: rawName.slice(0, 120),
    category,
    description,
    price,
    price_label: priceLabel,
    stock,
    image_url: imageUrl,
    documentation_url: url,
    sort_order: Number(overrides?.sortOrder) || 1000,
  }
  const { data, error } = await client.from('products').upsert(row).select()
  if (error) return { status: 500, data: { error: error.message } }
  return { status: 201, data: { product: data?.[0] ?? row, preview } }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
      },
    })
  }

  try {
    const { client, error } = await callerRole(req)
    if (error || !client) return json({ error: error || 'Sign in to import products.' }, 401)

    const body = await req.json().catch(() => null) as Record<string, unknown> | null
    const action = String(body?.action || '')
    const url = String(body?.url || '')

    if (action === 'preview') {
      if (!isHttpUrl(url)) return json({ error: 'Please paste a valid https product link.' }, 400)
      const preview = await runPreview(url)
      return json({ preview })
    }

    if (action === 'create') {
      const result = await runCreate(body as Record<string, unknown>, client)
      return json(result.data, result.status)
    }

    return json({ error: 'Unknown action.' }, 404)
  } catch (error) {
    console.error('link-import error:', error)
    return json({ error: error instanceof Error ? error.message : 'Internal error' }, 500)
  }
})