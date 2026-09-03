import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import {
  localCurriculumHighlights,
  localPilotCosts,
  localTrainingPrograms,
} from '../lib/programs-data'

// Minimal .env.local loader so `npm run seed:programs` works without extra dependencies.
function loadEnvFile() {
  try {
    const raw = readFileSync(join(process.cwd(), '.env.local'), 'utf8')
    for (const line of raw.split('\n')) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/)
      if (!match?.[1]) continue
      const key = match[1]
      const value = (match[2] || '').replace(/^["']|["']$/g, '')
      if (!process.env[key]) process.env[key] = value
    }
  } catch {
    // Fall back to already-set environment variables.
  }
}

async function main() {
  loadEnvFile()

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Add them to .env.local first.')
    process.exit(1)
  }

  const db = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const now = new Date().toISOString()

  const programs = localTrainingPrograms.map((row) => ({
    id: row.id,
    title: row.title,
    audience: row.audience,
    description: row.description,
    duration: row.duration,
    outcome: row.outcome,
    active: true,
    sort_order: row.sortOrder,
    updated_at: now,
  }))

  const costLines = localPilotCosts.map((row) => ({
    id: row.id,
    item: row.item,
    cost: row.cost,
    note: row.note,
    active: true,
    sort_order: row.sortOrder,
    updated_at: now,
  }))

  const highlights = localCurriculumHighlights.map((row) => ({
    id: row.id,
    age_band: row.ageBand,
    items: row.items,
    active: true,
    sort_order: row.sortOrder,
    updated_at: now,
  }))

  const results: Array<[string, string, object[]]> = [
    ['training_programs', 'training program(s)', programs],
    ['pilot_cost_lines', 'pilot cost line(s)', costLines],
    ['curriculum_highlights', 'curriculum highlight band(s)', highlights],
  ]

  let failed = false
  for (const [table, label, rows] of results) {
    const { error } = await db.from(table).upsert(rows, { onConflict: 'id' })
    if (error) {
      console.error(`Seeding ${table} failed:`, error.message)
      failed = true
    } else {
      console.log(`Seeded ${rows.length} ${label} into ${table}.`)
    }
  }
  process.exit(failed ? 1 : 0)
}

main()
