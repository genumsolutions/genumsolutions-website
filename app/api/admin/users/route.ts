import { NextResponse } from 'next/server'
import { isAdminRequest } from '../../../../lib/admin'
import { createServiceClient, getSessionUser } from '../../../../lib/supabase/server'
import { logActivity } from '../../../../lib/activity'
import { deleteUserRobotSetting, listUserRobotSettings, updateUserTier, upsertUserRobotSettings } from '../../../../lib/admin-users'

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
    const { data: profiles } = await db.from('profiles').select('id, name, phone, address, role, tier').in('id', ids)
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
        tier: profile?.tier === 'pro' ? 'pro' : 'free',
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

  // Lockout guard: an admin can never demote themselves (mirrors the
  // admin-set-role edge function the native app uses).
  const current = await getSessionUser()
  if (current && current.id === userId && role === 'customer') {
    return NextResponse.json({ error: 'You cannot revoke your own admin role.' }, { status: 400 })
  }

  try {
    const db = createServiceClient()
    // Upsert keeps working for profiles rows that predate the signup trigger.
    const { error } = await db.from('profiles').upsert({ id: userId, role }, { ignoreDuplicates: false })
    if (error) return NextResponse.json({ error: 'Could not update the role.' }, { status: 500 })
    await logActivity({ action: 'user.role_changed', entityType: 'user', entityId: userId, details: { role } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Admin role change failed', error)
    return NextResponse.json({ error: 'Could not update the role.' }, { status: 500 })
  }
}

// PATCH action=tier — flip a user between free/pro (the Remote window and
// robot preferences unlock at pro). Service-role write so the
// protect_tier_column trigger exempts it, mirroring the role path.
export async function PUT(request: Request) {
  if (!(await isAdminRequest())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => null)
  const userId = String(body?.userId || '')
  const tier = body?.tier
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
    return NextResponse.json({ error: 'A valid user id is required.' }, { status: 400 })
  }
  if (tier !== 'free' && tier !== 'pro') {
    return NextResponse.json({ error: 'Tier must be free or pro.' }, { status: 400 })
  }
  const ok = await updateUserTier(userId, tier)
  if (!ok) return NextResponse.json({ error: 'Could not update the tier.' }, { status: 500 })
  await logActivity({ action: 'user.tier_changed', entityType: 'user', entityId: userId, details: { tier } })
  return NextResponse.json({ ok: true })
}

// POST { action: 'listRobotSettings' | 'upsertRobotSetting' | 'deleteRobotSetting', userId, ... }
// — the per-user robot preference rows (code values / parameters / telemetry
// channels) managed from the admin Users tab.
export async function POST(request: Request) {
  if (!(await isAdminRequest())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => null)
  const action = String(body?.action || '')
  const userId = String(body?.userId || '')
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
    return NextResponse.json({ error: 'A valid user id is required.' }, { status: 400 })
  }

  if (action === 'listRobotSettings') {
    const robots = await listUserRobotSettings(userId)
    return NextResponse.json({ robots })
  }
  if (action === 'upsertRobotSetting') {
    const robotId = String(body?.robotId || '').trim()
    const robotName = String(body?.robotName || '').slice(0, 120)
    const settings = body?.settings
    if (!robotId || !/^[a-zA-Z0-9_.-]{1,64}$/.test(robotId)) {
      return NextResponse.json({ error: 'A valid robotId is required.' }, { status: 400 })
    }
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
      return NextResponse.json({ error: 'Settings must be a JSON object.' }, { status: 400 })
    }
    const ok = await upsertUserRobotSettings(userId, robotId, robotName, settings as Record<string, unknown>)
    if (!ok) return NextResponse.json({ error: 'Could not save the robot settings.' }, { status: 500 })
    await logActivity({ action: 'user.robot_settings_updated', entityType: 'user', entityId: userId, details: { robotId, via: 'admin' } })
    return NextResponse.json({ ok: true })
  }
  if (action === 'deleteRobotSetting') {
    const robotId = String(body?.robotId || '').trim()
    if (!robotId) return NextResponse.json({ error: 'A robotId is required.' }, { status: 400 })
    const ok = await deleteUserRobotSetting(userId, robotId)
    if (!ok) return NextResponse.json({ error: 'Could not delete the robot settings.' }, { status: 500 })
    await logActivity({ action: 'user.robot_settings_deleted', entityType: 'user', entityId: userId, details: { robotId, via: 'admin' } })
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
}
