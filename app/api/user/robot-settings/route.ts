import { NextResponse } from 'next/server'
import { createClient, createServiceClient, getSessionUser } from '../../../../lib/supabase/server'
import { logActivity } from '../../../../lib/activity'

// Robot user settings — the per-user engineering profile for each robot /
// project (code values, parameters, telemetry channels). Stored in the
// dedicated robot_user_settings table, fully separate from carts/orders.
//
//   GET  ?userId=<uuid>            → every (robot, settings) row for a user
//                                    (self-service or admin; admins may read
//                                    any user's rows — the admin panel uses
//                                    this to keep each user fully tracked)
//   PUT  { userId, robotId, robotName, settings }  → upsert one robot row
//                                    (self writes only carry the owner's id;
//                                    admin writes of other users run through
//                                    the service role)
//   DELETE ?userId=&robotId=       → remove one robot row (owner or admin)
//
// Shape guard: settings is a flat JSON object of scalar / string-array values
// (mirrors the app's settingsService sanitizer) so the table never drifts
// into unqueryable shapes.

type SettingsValue = string | number | boolean | string[]

function sanitizeSettings(input: unknown): Record<string, SettingsValue> | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null
  const out: Record<string, SettingsValue> = {}
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (!/^[a-zA-Z0-9_.-]{1,64}$/.test(key)) continue
    if (value == null || typeof value === 'number' || typeof value === 'boolean') {
      out[key] = value as SettingsValue
    } else if (typeof value === 'string' && value.length <= 2000) {
      out[key] = value as SettingsValue
    } else if (Array.isArray(value) && value.length <= 100 && value.every((item) => typeof item === 'string' && item.length <= 200)) {
      out[key] = value as string[]
    }
  }
  return out
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function resolveViewer() {
  const session = await getSessionUser()
  if (!session) return null
  const supabase = createClient()
  const { data: profile } = await supabase.from('profiles').select('role, tier').eq('id', session.id).maybeSingle()
  return { session, isAdmin: profile?.role === 'admin' }
}

export async function GET(request: Request) {
  const viewer = await resolveViewer()
  if (!viewer) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const params = new URL(request.url).searchParams
  const userId = params.get('userId') || viewer.session.id
  if (!UUID_RE.test(userId)) return NextResponse.json({ error: 'A valid userId is required.' }, { status: 400 })
  if (userId !== viewer.session.id && !viewer.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = viewer.isAdmin ? createServiceClient() : createClient()
  const { data, error } = await supabase
    .from('robot_user_settings')
    .select('robot_id, robot_name, settings, updated_at')
    .eq('user_id', userId)
    .order('robot_name', { ascending: true })
  if (error) return NextResponse.json({ error: 'Could not load robot settings.' }, { status: 500 })
  return NextResponse.json({ robots: data || [] })
}

export async function PUT(request: Request) {
  const viewer = await resolveViewer()
  if (!viewer) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => null)
  const userId = String(body?.userId || viewer.session.id)
  const robotId = String(body?.robotId || '').trim()
  const robotName = String(body?.robotName || '').slice(0, 120)
  const settings = sanitizeSettings(body?.settings)
  if (!UUID_RE.test(userId)) return NextResponse.json({ error: 'A valid userId is required.' }, { status: 400 })
  if (!robotId || !/^[a-zA-Z0-9_.-]{1,64}$/.test(robotId)) {
    return NextResponse.json({ error: 'A valid robotId is required.' }, { status: 400 })
  }
  if (!settings) return NextResponse.json({ error: 'Settings must be a flat JSON object.' }, { status: 400 })
  if (userId !== viewer.session.id && !viewer.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Pro gate: only pro users may hold robot preference rows. Admins are
  // always allowed (they manage every account, including their own).
  if (!viewer.isAdmin) {
    const supabase = createClient()
    const { data: profile } = await supabase.from('profiles').select('tier').eq('id', userId).maybeSingle()
    if (profile?.tier !== 'pro') {
      return NextResponse.json({ error: 'Robot settings are a Pro feature.' }, { status: 403 })
    }
  }

  const supabase = viewer.isAdmin && userId !== viewer.session.id ? createServiceClient() : createClient()
  const { error } = await supabase
    .from('robot_user_settings')
    .upsert(
      { user_id: userId, robot_id: robotId, robot_name: robotName, settings, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,robot_id' },
    )
  if (error) return NextResponse.json({ error: 'Could not save the robot settings.' }, { status: 500 })
  await logActivity({ action: 'user.robot_settings_updated', entityType: 'user', entityId: userId, details: { robotId } })
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request) {
  const viewer = await resolveViewer()
  if (!viewer) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const params = new URL(request.url).searchParams
  const userId = params.get('userId') || viewer.session.id
  const robotId = (params.get('robotId') || '').trim()
  if (!UUID_RE.test(userId) || !robotId) {
    return NextResponse.json({ error: 'A valid userId and robotId are required.' }, { status: 400 })
  }
  if (userId !== viewer.session.id && !viewer.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const supabase = viewer.isAdmin && userId !== viewer.session.id ? createServiceClient() : createClient()
  const { error } = await supabase
    .from('robot_user_settings')
    .delete()
    .eq('user_id', userId)
    .eq('robot_id', robotId)
  if (error) return NextResponse.json({ error: 'Could not delete the robot settings.' }, { status: 500 })
  await logActivity({ action: 'user.robot_settings_deleted', entityType: 'user', entityId: userId, details: { robotId } })
  return NextResponse.json({ ok: true })
}
