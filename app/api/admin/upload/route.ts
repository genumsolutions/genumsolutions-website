import { NextResponse } from 'next/server'
import { isAdminRequest } from '../../../../lib/admin'
import { createServiceClient } from '../../../../lib/supabase/server'

const MAX_BYTES = 4 * 1024 * 1024
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'])

export const runtime = 'nodejs'

export async function POST(request: Request) {
  if (!(await isAdminRequest())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const form = await request.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'Attach an image file.' }, { status: 400 })
  if (!ALLOWED.has(file.type)) return NextResponse.json({ error: 'Use a JPG, PNG, WebP, AVIF, or GIF image.' }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Image must be smaller than 4 MB.' }, { status: 400 })

  const extension = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase().replace(/[^a-z0-9]/g, '') : 'jpg'
  const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension || 'jpg'}`

  try {
    const db = createServiceClient()
    const { error } = await db.storage.from('product-images').upload(safeName, await file.arrayBuffer(), {
      contentType: file.type,
      cacheControl: '31536000',
      upsert: false,
    })
    if (error) throw error
    const { data } = db.storage.from('product-images').getPublicUrl(safeName)
    return NextResponse.json({ ok: true, url: data.publicUrl })
  } catch (error) {
    console.error('Image upload failed', error)
    return NextResponse.json({ error: 'Upload failed. Check the product-images bucket exists.' }, { status: 500 })
  }
}
