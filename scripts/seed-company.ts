import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { company } from '../lib/company'

// Minimal .env.local loader so `npm run seed:company` works without extra dependencies.
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

  const row = {
    id: 1,
    name: company.name,
    short_name: company.shortName,
    address: company.address,
    city: company.city,
    country: company.country,
    email: company.email,
    phone: company.phone,
    pan: company.pan,
    vat_label: company.vatLabel,
    description: company.description,
    updated_at: new Date().toISOString(),
  }

  const { error } = await db.from('company_info').upsert(row, { onConflict: 'id' })
  if (error) {
    console.error('Seeding company_info failed:', error.message)
    process.exit(1)
  }
  console.log(`Seeded company_info row (${row.name}).`)
  // Do NOT process.exit(0) here: Node on Windows can crash with
  // "Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)" when exit() cuts
  // off an open socket right after the write. End naturally instead.
}

main()
