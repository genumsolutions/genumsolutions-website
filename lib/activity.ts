import { createServiceClient } from './supabase/server'

export type ActivityEntry = {
  id: string
  userId: string | null
  action: string
  entityType: string
  entityId: string | null
  details: Record<string, unknown>
  createdAt: string
}

type ActivityRow = {
  id: string
  user_id: string | null
  action: string
  entity_type: string
  entity_id: string | null
  details: Record<string, unknown>
  created_at: string
}

function rowToActivity(row: ActivityRow): ActivityEntry {
  return {
    id: row.id,
    userId: row.user_id,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    details: row.details ?? {},
    createdAt: row.created_at,
  }
}

export async function logActivity(input: {
  userId?: string | null
  action: string
  entityType: string
  entityId?: string
  details?: Record<string, unknown>
}): Promise<void> {
  try {
    const supabase = createServiceClient()
    await supabase.from('activity_log').insert({
      user_id: input.userId ?? null,
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      details: input.details ?? {},
    })
  } catch {
    // Best-effort logging; never breaks the main flow.
  }
}

export async function listActivity(options: {
  page?: number
  limit?: number
  entityType?: string
} = {}): Promise<{ entries: ActivityEntry[]; total: number; page: number; totalPages: number }> {
  const page = Math.max(1, options.page ?? 1)
  const limit = Math.min(50, Math.max(1, options.limit ?? 20))
  const supabase = createServiceClient()

  let query = supabase.from('activity_log').select('*', { count: 'exact' })
  if (options.entityType) query = query.eq('entity_type', options.entityType)
  query = query.order('created_at', { ascending: false }).range((page - 1) * limit, page * limit - 1)

  const { data, count } = await query
  const entries = (data as ActivityRow[] | null)?.map(rowToActivity) ?? []
  const total = count ?? 0
  return { entries, total, page, totalPages: Math.max(1, Math.ceil(total / limit)) }
}
