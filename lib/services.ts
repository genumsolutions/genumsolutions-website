import { createServiceClient } from './supabase/server'

export type Service = {
  id: string
  name: string
  category: string
  priceLabel: string
  description: string
  tag: string
  sortOrder: number
  active: boolean
  createdAt: string
  updatedAt: string
}

type ServiceRow = {
  id: string
  name: string
  category: string
  price_label: string
  description: string
  tag: string
  sort_order: number
  active: boolean
  created_at: string
  updated_at: string
}

function rowToService(row: ServiceRow): Service {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    priceLabel: row.price_label,
    description: row.description,
    tag: row.tag,
    sortOrder: row.sort_order,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function serviceToRow(service: Partial<Service>): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  if (service.name !== undefined) row.name = service.name
  if (service.category !== undefined) row.category = service.category
  if (service.priceLabel !== undefined) row.price_label = service.priceLabel
  if (service.description !== undefined) row.description = service.description
  if (service.tag !== undefined) row.tag = service.tag
  if (service.sortOrder !== undefined) row.sort_order = service.sortOrder
  if (service.active !== undefined) row.active = service.active
  row.updated_at = new Date().toISOString()
  return row
}

export async function listServices(includeInactive = false): Promise<Service[]> {
  const supabase = createServiceClient()
  let query = supabase.from('services').select('*').order('sort_order')
  if (!includeInactive) query = query.eq('active', true)
  const { data } = await query
  return (data as ServiceRow[] | null)?.map(rowToService) ?? []
}

export async function getService(id: string): Promise<Service | null> {
  const supabase = createServiceClient()
  const { data } = await supabase.from('services').select('*').eq('id', id).single()
  return data ? rowToService(data as ServiceRow) : null
}

export async function saveService(service: Partial<Service> & { id: string; name: string }): Promise<Service> {
  const supabase = createServiceClient()
  const row = serviceToRow(service)
  row.id = service.id
  row.name = service.name
  const { data } = await supabase.from('services').upsert(row, { onConflict: 'id' }).select().single()
  return rowToService(data as ServiceRow)
}

export async function deleteService(id: string): Promise<boolean> {
  const supabase = createServiceClient()
  const { error } = await supabase.from('services').delete().eq('id', id)
  return !error
}
