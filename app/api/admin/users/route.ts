import { NextResponse } from 'next/server'
import { isAdminRequest } from '../../../../lib/admin'
import { createServiceClient } from '../../../../lib/supabase/server'

// Admin-only user directory. Reads auth users (emails) via the service role
// because RLS hides auth.users from normal clients; role changes also run
// through the service client so the DB trigger's service_role exemption
// applies. Regular clients can never reach this route without an admin session.
export async function GET(request: Request) {
  if (!(await isAdminRequest())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ error: 'Service role key is not configured.' }, { status: 503 })

  const params = new URL(request.url).searchParams
  const page = Math.max(1, Number(params.get('page')) || 1)
  const limit = Math.min(50, Math.max(5, Number(params.get('limit')) || 10))
  const needle = (params.get('q') || '').trim().toLowerCase()

  try {
    const db = createServiceClient()
    // Fetch one extra row to detect whether a next page exists.
    const { data: listData, error: listError } = await db.auth.admin.listUsers({ page, perPage: limit + 1 })
    if (listError || !listData) return NextResponse.json({ error: 'Could not load users.' }, { status: 500 })

    let users = listData.users
    const hasMore = users.length > limit
    if (hasMore) users = users.slice(0, limit)

    const ids = users.map((user) => user.id)
    const { data: profiles } = await db.from('profiles').select('id, name, phone, address, role').in('id', ids)
    const profileById = new Map((profiles || []).map((profile) => [profile.id, profile]))

    let rows = users.map((user) => {
      const profile = profileById.get(user.id)
      return {
        id: user.id,
        email: user.email ?? '',
        name: profile?.name || '',
        phone: profile?.phone || '',
        address: profile?.address || '',
        role: (profile?.role as string) || 'customer',
        createdAt: user.created_at,
        lastSignInAt: user.last_sign_in_at,
      }
    })
    if (needle) {
      rows = rows.filter((row) => `${row.email} ${row.name}`.toLowerCase().includes(needle))
    }

    return NextResponse.json({
      users: rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      page,
      totalPages: Math.max(1, page + (hasMore ? 1 : 0)),
      totalKnown: false,
      hasMore,
    })
  } catch (error) {
    console.error('Admin users listing failed', error)
    return NextResponse.json({ error: 'Could not load users.' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  if (!(await isAdminRequest())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ error: 'Service role key is not configured.' }, { status: 503 })

  const body = await request.json().catch(() => null)
  const userId = String(body?.userId || '')
  const role = body?.role
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
    return NextResponse.json({ error: 'A valid user id is required.' }, { status: 400 })
  }
  if (role !== 'admin' && role !== 'customer') {
    return NextResponse.json({ error: 'Role must be admin or customer.' }, { status: 400 })
  }

  try {
    const db = createServiceClient()
    // Upsert keeps working for profiles rows that predate the signup trigger.
    const { error } = await db.from('profiles').upsert({ id: userId, role }, { ignoreDuplicates: false })
    if (error) return NextResponse.json({ error: 'Could not update the role.' }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Admin role change failed', error)
    return NextResponse.json({ error: 'Could not update the role.' }, { status: 500 })
  }
}
