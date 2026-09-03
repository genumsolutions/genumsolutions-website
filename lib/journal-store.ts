import { localJournalPosts } from './journal-data'
import type { JournalPost } from './journal'
import { createServiceClient, supabaseConfigured } from './supabase/server'
import { unstable_noStore } from 'next/cache'

// Reads the authoritative journal. Falls back to the bundled posts when
// Supabase is not configured or unreachable so the page never renders empty.
export async function getJournalPosts(): Promise<JournalPost[]> {
  unstable_noStore()
  if (!supabaseConfigured()) return localJournalPosts
  try {
    const db = createServiceClient()
    const { data, error } = await db
      .from('journal_posts')
      .select('id, tag, title, text')
      .eq('active', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
    if (error) throw error
    if (!data || data.length === 0) return localJournalPosts
    return data.map((row) => ({
      id: row.id,
      tag: row.tag,
      title: row.title,
      text: row.text,
    }))
  } catch (error) {
    console.error('Supabase journal read failed; using local posts.', error)
    return localJournalPosts
  }
}
