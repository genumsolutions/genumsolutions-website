// =====================================================================
// company-store.ts - DB-first read of the shared `company_info` table
// (the SAME single row the native app reads via its companyService), so
// business contact/brand edits made in the DB show on both clients.
//
// The bundled lib/company.ts remains the offline/default fallback and the
// seed source. Every field is merged per-field (DB value wins only when
// non-empty), so a partial row can never blank out a default.
//
// The result is cached with unstable_cache (TTL + tag below) so the whole
// site does not become fully dynamic just to render the shared footer /
// layout metadata. After an edit in the DB it can take up to the TTL for
// the cached copy to refresh; call revalidateTag('company-info') from an
// admin write path to purge it immediately.
// =====================================================================
import { unstable_cache } from 'next/cache'
import { company as defaultCompany, type Company } from './company'
import { createServiceClient, supabaseConfigured } from './supabase/server'

type CompanyRow = {
  name: string | null
  short_name: string | null
  address: string | null
  city: string | null
  country: string | null
  email: string | null
  phone: string | null
  pan: string | null
  vat_label: string | null
  description: string | null
}

const COMPANY_CACHE_TTL_SECONDS = 300

function mergeRow(row: CompanyRow): Company {
  const pick = (db: string | null, fallback: string) => (db && db.trim() ? db.trim() : fallback)
  return {
    name: pick(row.name, defaultCompany.name),
    shortName: pick(row.short_name, defaultCompany.shortName),
    // url is environment-derived (site URL differs dev/prod) - never from the DB.
    url: process.env.NEXT_PUBLIC_SITE_URL || defaultCompany.url,
    address: pick(row.address, defaultCompany.address),
    city: pick(row.city, defaultCompany.city),
    country: pick(row.country, defaultCompany.country),
    email: pick(row.email, defaultCompany.email),
    phone: pick(row.phone, defaultCompany.phone),
    pan: pick(row.pan, defaultCompany.pan),
    vatLabel: pick(row.vat_label, defaultCompany.vatLabel),
    description: pick(row.description, defaultCompany.description),
  }
}

async function readCompanyCached(): Promise<Company> {
  if (!supabaseConfigured()) return defaultCompany
  try {
    const db = createServiceClient()
    const { data, error } = await db.from('company_info').select('*').eq('id', 1).maybeSingle()
    if (error) throw error
    if (!data) return defaultCompany
    return mergeRow(data as CompanyRow)
  } catch (error) {
    console.error('Supabase company_info read failed; using bundled data.', error)
    return defaultCompany
  }
}

const getCompanyCached = unstable_cache(readCompanyCached, ['company-info'], {
  revalidate: COMPANY_CACHE_TTL_SECONDS,
  tags: ['company-info'],
})

/** Company details, DB-first with bundled fallback (cached up to 5 min). */
export async function getCompany(): Promise<Company> {
  return getCompanyCached()
}

/** Purge the cached company info (call from an admin write path). */
export async function invalidateCompanyCache(): Promise<void> {
  const { revalidateTag } = await import('next/cache')
  revalidateTag('company-info')
}
