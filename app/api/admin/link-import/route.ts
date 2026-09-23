// =====================================================================
// /api/admin/link-import — cookie-gated proxy for the `link-import` edge
// function, so the website admin can paste any product URL and import it
// the same way the native app does (edge function verifies the caller JWT
// staff+ server-side, extracts metadata, uploads the image, upserts the
// row).
//
// POST { action: 'preview'|'create', url, product? }
//   preview -> { preview }                      (extract only, no DB write)
//   create  -> { product, preview }             (extract + save)
//
// Staff+ (same gate as the rest of /api/admin). The caller's Supabase
// session access token is forwarded as the edge function bearer so the
// function's own role check runs against the real signed-in user.
// =====================================================================
import { NextResponse } from 'next/server'
import { isStaffRequest } from '../../../../lib/admin'
import { createClient } from '../../../../lib/supabase/server'

const EDGE_BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/$/, '')}/functions/v1`

export async function POST(request: Request) {
  if (!(await isStaffRequest())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await request.json().catch(() => null)
    if (!body?.action || !body?.url) return NextResponse.json({ error: 'action and url are required.' }, { status: 400 })

    const supabase = createClient()
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    const accessToken = sessionData?.session?.access_token
    if (sessionError || !accessToken) return NextResponse.json({ error: 'Could not read your session.' }, { status: 401 })

    const res = await fetch(`${EDGE_BASE}/link-import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(body),
    })
    const data = (await res.json().catch(() => null)) ?? {}
    if (!res.ok) {
      return NextResponse.json({ error: data.error || 'Import failed.' }, { status: res.status })
    }
    return NextResponse.json(data)
  } catch (error) {
    console.error('Admin link-import failed', error)
    return NextResponse.json({ error: 'Could not import from that link.' }, { status: 500 })
  }
}