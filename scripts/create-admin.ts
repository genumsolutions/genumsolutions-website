// One-off helper: create/promote an admin user by email.
// Usage: npx tsx scripts/create-admin.ts <email> [password]
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

// Minimal .env.local loader so the script runs without extra dependencies.
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

const rawEmail = process.argv[2]
const password = process.argv[3]

if (!rawEmail || !password) {
  console.error('Usage: npx tsx scripts/create-admin.ts <email> <password>')
  process.exit(1)
}
const email: string = rawEmail

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is not set.')
  process.exit(1)
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

async function main() {
  // Find existing user (service role can list users)
  let userId: string | null = null
  let page = 1
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const match = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
    if (match) {
      userId = match.id
      break
    }
    if (data.users.length < 200 || page * 200 >= (data.totalUsers ?? data.users.length)) break
    page++
  }

  if (userId) {
    console.log(`User already exists: ${email} (${userId})`)
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name: email.split('@')[0] },
    })
    if (error) throw error
    userId = data.user!.id
    console.log(`Created auth user: ${email} (${userId})`)
  }

  const name = email.split('@')[0]
  const { error } = await supabase.from('profiles').upsert({ id: userId, name, role: 'admin' })
  if (error) throw error
  console.log(`Profile upserted with role=admin for ${email}`)
}

main().catch((err) => {
  console.error('FAILED:', err.message ?? err)
  process.exit(1)
})
