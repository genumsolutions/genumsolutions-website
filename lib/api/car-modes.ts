import { createServiceClient } from './supabase/server'

export async function fetchCarModes() {
  const db = createServiceClient()
  const { data, error } = await db.from('robo_car_modes').select('*').order('sort_order', { ascending: true }).order('name', { ascending: true })
  if (error) throw error
  return (data || []) as any[]
}

export async function saveCarMode(mode: any) {
  const db = createServiceClient()
  await db.from('robo_car_modes').upsert({
    id: mode.id,
    name: mode.name,
    token: mode.token,
    device_index: mode.deviceIndex,
    car: mode.car,
    wheel: mode.wheel,
    steering: mode.steering,
    sensors: mode.sensors,
    transport: mode.transport,
    remote_with: mode.remoteWith,
    controls: mode.controls,
    requires_connection: mode.requiresConnection,
    blurb: mode.blurb,
    sort_order: mode.sortOrder,
    updated_at: new Date().toISOString(),
  })
}

export async function deleteCarMode(id: string) {
  const db = createServiceClient()
  await db.from('robo_car_modes').delete().eq('id', id)
}