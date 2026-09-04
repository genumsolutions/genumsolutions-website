// =====================================================================
// settings-store.ts - admin CRUD for the shared content tables that the
// native app's admin Settings tab also manages: company_info,
// training_programs, pilot_cost_lines, and curriculum_highlights.
//
// All writes go through the service-role client (RLS is admin-write);
// the public reads on the site use company-store / programs-store.
// SERVER-ONLY - never import from client components.
// =====================================================================
import { createServiceClient, supabaseConfigured } from './supabase/server'
import { invalidateCompanyCache } from './company-store'

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return (value as unknown[]).map(String)
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) return parsed.map(String)
    } catch {
      // ignore — single-element fallback below
    }
    return [value]
  }
  return []
}

export type ManagedCompanyInfo = {
  name: string
  shortName: string
  address: string
  city: string
  country: string
  email: string
  phone: string
  pan: string
  vatLabel: string
  description: string
}

export type ManagedTrainingProgram = {
  id: string
  title: string
  audience: string
  description: string
  duration: string
  outcome: string
  active: boolean
  sortOrder: number
}

export type ManagedPilotCostLine = {
  id: string
  item: string
  cost: string
  note: string
  active: boolean
  sortOrder: number
}

export type ManagedCurriculumHighlight = {
  id: string
  ageBand: string
  items: string[]
  active: boolean
  sortOrder: number
}

export type SettingsBundle = {
  company: ManagedCompanyInfo
  trainingPrograms: ManagedTrainingProgram[]
  pilotCostLines: ManagedPilotCostLine[]
  curriculumHighlights: ManagedCurriculumHighlight[]
}

const emptyCompany: ManagedCompanyInfo = {
  name: '', shortName: '', address: '', city: '', country: '',
  email: '', phone: '', pan: '', vatLabel: '', description: '',
}

export async function getManagedSettings(): Promise<SettingsBundle> {
  const db = createServiceClient()

  const [{ data: companyRow }, { data: programs }, { data: pilots }, { data: curricula }] = await Promise.all([
    db.from('company_info').select('*').eq('id', 1).maybeSingle(),
    db.from('training_programs').select('*').order('sort_order', { ascending: true }),
    db.from('pilot_cost_lines').select('*').order('sort_order', { ascending: true }),
    db.from('curriculum_highlights').select('*').order('sort_order', { ascending: true }),
  ])

  const company: ManagedCompanyInfo = companyRow
    ? {
        name: companyRow.name ?? '', shortName: companyRow.short_name ?? '',
        address: companyRow.address ?? '', city: companyRow.city ?? '', country: companyRow.country ?? '',
        email: companyRow.email ?? '', phone: companyRow.phone ?? '', pan: companyRow.pan ?? '',
        vatLabel: companyRow.vat_label ?? '', description: companyRow.description ?? '',
      }
    : { ...emptyCompany }

  return {
    company,
    trainingPrograms: (programs ?? []).map((row) => ({
      id: row.id ?? '', title: row.title ?? '', audience: row.audience ?? '',
      description: row.description ?? '', duration: row.duration ?? '', outcome: row.outcome ?? '',
      active: row.active !== false, sortOrder: Number(row.sort_order ?? 0),
    })),
    pilotCostLines: (pilots ?? []).map((row) => ({
      id: row.id ?? '', item: row.item ?? '', cost: row.cost ?? '', note: row.note ?? '',
      active: row.active !== false, sortOrder: Number(row.sort_order ?? 0),
    })),
    curriculumHighlights: (curricula ?? []).map((row) => ({
      id: row.id ?? '', ageBand: row.age_band ?? '', items: toStringArray(row.items),
      active: row.active !== false, sortOrder: Number(row.sort_order ?? 0),
    })),
  }
}

export async function saveCompanyInfo(info: ManagedCompanyInfo): Promise<void> {
  const db = createServiceClient()
  await db.from('company_info').upsert({
    id: 1,
    name: info.name, short_name: info.shortName, address: info.address, city: info.city,
    country: info.country, email: info.email, phone: info.phone, pan: info.pan,
    vat_label: info.vatLabel, description: info.description, updated_at: new Date().toISOString(),
  })
  await invalidateCompanyCache()
}

export async function saveTrainingProgram(program: ManagedTrainingProgram): Promise<void> {
  await createServiceClient().from('training_programs').upsert({
    id: program.id, title: program.title, audience: program.audience,
    description: program.description, duration: program.duration, outcome: program.outcome,
    active: program.active !== false, sort_order: Math.max(0, Math.round(Number(program.sortOrder) || 0)),
    updated_at: new Date().toISOString(),
  })
}

export async function deleteTrainingProgram(id: string): Promise<void> {
  await createServiceClient().from('training_programs').delete().eq('id', id)
}

export async function savePilotCostLine(line: ManagedPilotCostLine): Promise<void> {
  await createServiceClient().from('pilot_cost_lines').upsert({
    id: line.id, item: line.item, cost: line.cost, note: line.note,
    active: line.active !== false, sort_order: Math.max(0, Math.round(Number(line.sortOrder) || 0)),
    updated_at: new Date().toISOString(),
  })
}

export async function deletePilotCostLine(id: string): Promise<void> {
  await createServiceClient().from('pilot_cost_lines').delete().eq('id', id)
}

export async function saveCurriculumHighlight(highlight: ManagedCurriculumHighlight): Promise<void> {
  await createServiceClient().from('curriculum_highlights').upsert({
    id: highlight.id, age_band: highlight.ageBand, items: highlight.items,
    active: highlight.active !== false, sort_order: Math.max(0, Math.round(Number(highlight.sortOrder) || 0)),
    updated_at: new Date().toISOString(),
  })
}

export async function deleteCurriculumHighlight(id: string): Promise<void> {
  await createServiceClient().from('curriculum_highlights').delete().eq('id', id)
}

export { supabaseConfigured }
