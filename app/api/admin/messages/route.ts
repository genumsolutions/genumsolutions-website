import { NextResponse } from 'next/server'
import { isAdminRequest } from '../../../../lib/admin'
import { createServiceClient } from '../../../../lib/supabase/server'

export async function GET(request: Request) {
  if (!(await isAdminRequest())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, Number(searchParams.get('page')) || 1)
    const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit')) || 20))
    const status = searchParams.get('status') || undefined

    const supabase = createServiceClient()
    let query = supabase.from('customer_messages').select('*', { count: 'exact' })
    if (status) query = query.eq('status', status)
    query = query.order('created_at', { ascending: false }).range((page - 1) * limit, page * limit - 1)

    const { data, count, error } = await query
    if (error) return NextResponse.json({ error: 'Could not load messages.' }, { status: 500 })
    return NextResponse.json({
      messages: data ?? [],
      total: count ?? 0,
      page,
      totalPages: Math.max(1, Math.ceil((count ?? 0) / limit)),
    })
  } catch (error) {
    console.error('Admin messages failed', error)
    return NextResponse.json({ error: 'Could not load messages.' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  if (!(await isAdminRequest())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await request.json().catch(() => null)
    if (!body?.id) return NextResponse.json({ error: 'Missing id.' }, { status: 400 })

    const supabase = createServiceClient()
    const { error } = await supabase.from('customer_messages').update({ status: body.status ?? 'replied' }).eq('id', body.id)
    if (error) return NextResponse.json({ error: 'Could not update message.' }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Message update failed', error)
    return NextResponse.json({ error: 'Could not update message.' }, { status: 500 })
  }
}
