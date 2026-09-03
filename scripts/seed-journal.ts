import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { localJournalPosts as posts } from '../lib/journal-data'

// Minimal .env.local loader so `npm run seed:journal` works without extra dependencies.
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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Add them to .env.local first.')
  process.exit(1)
}

const db = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

const rows = posts.map((post, index) => ({
  id: post.id,
  tag: post.tag,
  title: post.title,
  text: post.text,
  active: true,
  sort_order: index + 1,
  updated_at: new Date().toISOString(),
}))

const { error } = await db.from('journal_posts').upsert(rows, { onConflict: 'id' })
if (error) {
  console.error('Seeding journal_posts failed:', error.message)
  process.exit(1)
}
console.log(`Seeded ${rows.length} journal post(s) into journal_posts.`)
