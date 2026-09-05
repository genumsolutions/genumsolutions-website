import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { Client } from 'pg'

// Minimal .env.local loader so `npm run db:apply` works without extra
// dependencies (same pattern as scripts/seed-products.ts).
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

loadEnvFile()

const dbUrl = process.env.SUPABASE_DB_URL
if (!dbUrl) {
  console.error(
    'Missing SUPABASE_DB_URL. Add it to .env.local first (Supabase Dashboard ' +
      '-> Database -> Connect -> Connection string, "postgres" role, ' +
      'e.g. postgresql://postgres.<project-ref>:<DB-PASSWORD>@aws-0-<region>.pooler.supabase.com:5432/postgres).',
  )
  process.exit(1)
}

const schemaPath = join(process.cwd(), 'supabase', 'schema.sql')
const sql = readFileSync(schemaPath, 'utf8')
if (!sql.trim()) {
  console.error(`schema.sql is empty at ${schemaPath}`)
  process.exit(1)
}

const seed = process.argv.slice(2).includes('--seed')

function runSeeds() {
  const scripts = ['seed-products.ts', 'seed-journal.ts', 'seed-programs.ts', 'seed-company.ts']
  for (const script of scripts) {
    console.log(`Seeding via ${script} ...`)
    const result = spawnSync(`npx`, [`tsx`, `scripts/${script}`], {
      cwd: process.cwd(),
      stdio: 'inherit',
      shell: process.platform === 'win32',
    })
    if (result.status !== 0) {
      throw new Error(`${script} failed (exit ${result.status ?? '?'}); aborting the seed pass.`)
    }
  }
}

async function main() {
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
  })
  try {
    await client.connect()
    console.log(`Connected to Supabase Postgres - applying ${schemaPath} in one transaction ...`)
    // schema.sql is written idempotently (create table if not exists,
    // create or replace function, drop ... if exists). Running the whole
    // file as a single multi-statement query wraps it in one implicit
    // transaction: any statement failure rolls everything back.
    await client.query(sql)
    console.log('Schema applied successfully.')
    if (seed) {
      runSeeds()
      console.log('Seeds complete: products, journal, programs, company.')
    } else {
      console.log('Hint: run `npm run db:apply:seed` to also re-seed products/journal/programs/company.')
    }
  } finally {
    await client.end()
  }
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err)
  console.error(`Apply-schema failed: ${message}`)
  process.exit(1)
})