import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  reads: {} as Record<string, unknown>,
  upserts: [] as { table: string; row: Record<string, unknown> }[],
  deletes: [] as { table: string; id: unknown }[],
  invalidateCalls: 0,
}))

vi.mock('../lib/supabase/server', () => ({
  supabaseConfigured: () => true,
  createServiceClient: () => ({
    from: (table: string) => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: state.reads[table] ?? null }) }),
        order: async () => ({ data: state.reads[table] ?? [] }),
      }),
      upsert: async (row: Record<string, unknown>) => {
        state.upserts.push({ table, row })
      },
      delete: () => ({
        eq: async (_column: string, id: string) => {
          state.deletes.push({ table, id })
        },
      }),
    }),
  }),
}))

vi.mock('../lib/company-store', () => ({
  invalidateCompanyCache: async () => {
    state.invalidateCalls += 1
  },
}))

import {
  deleteCurriculumHighlight,
  deletePilotCostLine,
  deleteTrainingProgram,
  getManagedSettings,
  saveCompanyInfo,
  saveCurriculumHighlight,
  savePilotCostLine,
  saveTrainingProgram,
} from '../lib/settings-store'

beforeEach(() => {
  state.reads = {}
  state.upserts = []
  state.deletes = []
  state.invalidateCalls = 0
})

describe('getManagedSettings', () => {
  it('maps snake_case rows onto the camelCase Managed* shapes', async () => {
    state.reads = {
      company_info: { id: 1, name: 'GENUM SOLUTIONS', short_name: 'GENUM', country: 'Nepal', phone: '+977', pan: 'PAN' },
      training_programs: [{
        id: 'p1', title: 'Robotics 101', audience: 'Students', description: 'd', duration: '2h', outcome: 'o',
        active: false, sort_order: 3,
      }],
      pilot_cost_lines: [{ id: 'c1', item: 'Filament', cost: 'NPR 500', note: 'n', active: true, sort_order: 1 }],
      curriculum_highlights: [{ id: 'cur1', age_band: 'Ages 8-11', items: ['Build', 'Code'], active: true, sort_order: 2 }],
    }

    const bundle = await getManagedSettings()
    expect(bundle.company).toMatchObject({ name: 'GENUM SOLUTIONS', shortName: 'GENUM', country: 'Nepal' })
    expect(bundle.trainingPrograms).toEqual([{
      id: 'p1', title: 'Robotics 101', audience: 'Students', description: 'd', duration: '2h', outcome: 'o',
      active: false, sortOrder: 3,
    }])
    expect(bundle.pilotCostLines).toEqual([{ id: 'c1', item: 'Filament', cost: 'NPR 500', note: 'n', active: true, sortOrder: 1 }])
    expect(bundle.curriculumHighlights).toEqual([{ id: 'cur1', ageBand: 'Ages 8-11', items: ['Build', 'Code'], active: true, sortOrder: 2 }])
  })

  it('defaults active to true and treats a JSON-string items column like an array', async () => {
    state.reads = {
      training_programs: [{ id: 'p2', active: null, sort_order: 0 }],
      curriculum_highlights: [{ id: 'cur2', age_band: 'B', items: '["x","y"]', active: true, sort_order: 0 }],
    }

    const bundle = await getManagedSettings()
    expect(bundle.trainingPrograms[0]!.active).toBe(true)
    expect(bundle.curriculumHighlights[0]!.items).toEqual(['x', 'y'])
  })

  it('falls back to an empty company form when no company_info row exists', async () => {
    state.reads = { training_programs: [], pilot_cost_lines: [], curriculum_highlights: [] }
    const bundle = await getManagedSettings()
    expect(bundle.company).toEqual({
      name: '', shortName: '', address: '', city: '', country: '',
      email: '', phone: '', pan: '', vatLabel: '', description: '',
    })
  })
})

describe('save mutations (camelCase in, snake_case out)', () => {
  it('saveTrainingProgram maps fields, coerces active and clamps sort_order', async () => {
    await saveTrainingProgram({
      id: 'p1', title: 'T', audience: 'A', description: 'D', duration: '2h', outcome: 'O',
      active: false, sortOrder: 2.6,
    })
    expect(state.upserts).toHaveLength(1)
    expect(state.upserts[0]!.table).toBe('training_programs')
    expect(state.upserts[0]!.row).toMatchObject({
      id: 'p1', title: 'T', audience: 'A', description: 'D', duration: '2h', outcome: 'O',
      active: false, sort_order: 3,
    })
  })

  it('negative and NaN sort_order are clamped to 0', async () => {
    await savePilotCostLine({ id: 'c1', item: 'i', cost: '', note: '', active: true, sortOrder: -5 })
    await saveTrainingProgram({ id: 'p2', title: 'X', audience: '', description: '', duration: '', outcome: '', active: true, sortOrder: Number.NaN })
    const pilot = state.upserts[0]!
    const training = state.upserts[1]!
    expect(pilot.row.sort_order).toBe(0)
    expect(training.row.sort_order).toBe(0)
  })

  it('saveCurriculumHighlight stores the items array verbatim', async () => {
    await saveCurriculumHighlight({ id: 'cur1', ageBand: 'Ages 8-11', items: ['a', 'b'], active: true, sortOrder: 1 })
    expect(state.upserts[0]!.table).toBe('curriculum_highlights')
    expect(state.upserts[0]!.row).toMatchObject({ id: 'cur1', age_band: 'Ages 8-11', items: ['a', 'b'], sort_order: 1 })
  })

  it('saveCompanyInfo writes the single company row and invalidates the public cache', async () => {
    await saveCompanyInfo({
      name: 'GENUM', shortName: 'GENUM', address: 'Kathmandu', city: 'KTM', country: 'NP',
      email: 'a@b.c', phone: '+977', pan: 'PAN', vatLabel: 'PAN', description: 'desc',
    })
    expect(state.upserts[0]!.table).toBe('company_info')
    expect(state.upserts[0]!.row).toMatchObject({ id: 1, name: 'GENUM', short_name: 'GENUM', vat_label: 'PAN' })
    expect(state.upserts[0]!.row.updated_at).toBeTruthy()
    expect(state.invalidateCalls).toBe(1)
  })

  it('delete helpers target the right table and id', async () => {
    await deleteTrainingProgram('p1')
    await deletePilotCostLine('c1')
    await deleteCurriculumHighlight('cur1')
    expect(state.deletes).toEqual([
      { table: 'training_programs', id: 'p1' },
      { table: 'pilot_cost_lines', id: 'c1' },
      { table: 'curriculum_highlights', id: 'cur1' },
    ])
  })
})