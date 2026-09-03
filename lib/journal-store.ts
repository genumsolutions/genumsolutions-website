import { localJournalPosts } from './journal-data'
import type { JournalPost } from './journal'
import { createServiceClient, supabaseConfigured } from './supabase/server'
import { unstable_noStore } from 'next/cache'

/** Admin-facing journal row (includes hidden posts + ordering fields). */
export type ManagedJournalPost = JournalPost & {
  active: boolean
  sortOrder: number
}

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

/** Admin read: every journal post (active or hidden), newest first. */
export async function getManagedJournalPosts(): Promise<ManagedJournalPost[]> {
  unstable_noStore()
  if (!supabaseConfigured()) {
    return localJournalPosts.map((post, index) => ({ ...post, active: true, sortOrder: index + 1 }))
  }
  try {
    const db = createServiceClient()
    const { data, error } = await db
      .from('journal_posts')
      .select('id, tag, title, text, active, sort_order')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
    if (error) throw error
    if (!data || data.length === 0) {
      return localJournalPosts.map((post, index) => ({ ...post, active: true, sortOrder: index + 1 }))
    }
    return data.map((row) => ({
      id: row.id,
      tag: row.tag,
      title: row.title,
      text: row.text,
      active: row.active !== false,
      sortOrder: row.sort_order ?? 0,
    }))
  } catch (error) {
    console.error('Supabase journal admin read failed; using local posts.', error)
    return localJournalPosts.map((post, index) => ({ ...post, active: true, sortOrder: index + 1 }))
  }
}

/** Admin write: create or update a journal post (upsert). */
export async function saveJournalPost(post: ManagedJournalPost) {
  await createServiceClient().from('journal_posts').upsert({
    id: post.id,
    tag: post.tag,
    title: post.title,
    text: post.text,
    active: post.active !== false,
    sort_order: Math.max(0, Math.round(Number(post.sortOrder) || 0)),
    updated_at: new Date().toISOString(),
  })
}

/** Admin delete: remove a journal post by id. */
export async function deleteJournalPost(id: string) {
  await createServiceClient().from('journal_posts').delete().eq('id', id)
}
