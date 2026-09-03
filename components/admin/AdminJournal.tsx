'use client'

import { FormEvent, useEffect, useState } from 'react'
import { inputClass } from '../../lib/styles'
import type { JournalItem } from './admin-types'
import { emptyJournal } from './admin-types'
import { focusEditor } from './admin-helpers'

type Props = { setMessage: (msg: string) => void }

function slugify(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

export default function AdminJournal({ setMessage }: Props) {
  const [posts, setPosts] = useState<JournalItem[]>([])
  const [loaded, setLoaded] = useState(false)
  const [post, setPost] = useState<JournalItem>(emptyJournal)
  const [previewPost, setPreviewPost] = useState<JournalItem | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void fetch('/api/admin/journal').then((r) => r.json()).then((d) => setPosts(d.posts ?? [])).catch(() => undefined).finally(() => setLoaded(true))
  }, [])

  function updatePost(key: keyof JournalItem, value: string | number | boolean) {
    setPost((current) => ({ ...current, [key]: value }))
  }

  async function savePostItem(event?: FormEvent) {
    event?.preventDefault()
    if (!post.title?.trim()) { setMessage('Journal post needs at least a title.'); return }
    setBusy(true)
    const payload: JournalItem = {
      ...post,
      title: post.title.trim(),
      id: post.id?.trim() ? slugify(post.id) : slugify(post.title),
      tag: (post.tag || '').trim(),
      text: (post.text || '').trim(),
      sortOrder: Math.max(0, Math.round(Number(post.sortOrder) || 0)),
    }
    const response = await fetch('/api/admin/journal', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) { setMessage(result.error || 'Could not save journal post.'); setBusy(false); return }
    setPosts((current) => [...current.filter((p) => p.id !== payload.id), payload].sort((a, b) => a.sortOrder - b.sortOrder))
    setPost(emptyJournal)
    setMessage('Journal post saved.')
    setBusy(false)
  }

  async function removePost(id: string) {
    if (!window.confirm(`Delete journal post ${id}?`)) return
    const response = await fetch(`/api/admin/journal?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    if (response.ok) { setPosts((current) => current.filter((p) => p.id !== id)); setMessage('Journal post deleted.') }
  }

  async function togglePostVisibility(item: JournalItem) {
    const payload = { ...item, active: !item.active }
    const response = await fetch('/api/admin/journal', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    if (response.ok) { setPosts((current) => current.map((p) => p.id === item.id ? payload : p)); setMessage(item.active ? 'Post unpublished.' : 'Post published.') }
  }

  return (
    <>
      <div role="tabpanel" id="panel-journal" aria-labelledby="tab-journal" className="mt-8 grid min-w-0 gap-8 xl:grid-cols-[1fr_1.3fr]">
        <section aria-label="Journal post list" className="min-w-0 space-y-6">
          <div className="min-w-0 border-t-2 border-ink bg-white p-6">
            <h2 className="font-display text-xl font-bold">Journal posts ({posts.length})</h2>
            <p className="mt-1 text-xs text-slate-500">
              Published posts appear on /journal and in the native app's Journal screen. Editing here updates the DB - both clients render the latest copy.
            </p>
            {!loaded ? <p className="mt-3 text-sm text-slate-500" role="status">Loading…</p> : (
              <div className="mt-3 divide-y divide-line">
                {posts.map((p) => (
                  <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <div className="min-w-0 flex-1">
                      <span className="block line-clamp-2 text-sm"><strong>{p.title}</strong> <span className="text-slate-400">{p.tag}</span></span>
                      {!p.active && <span className="ml-2 text-[10px] font-black uppercase text-red-500">hidden</span>}
                    </div>
                    <span className="flex shrink-0 flex-wrap gap-2">
                      <button onClick={() => { setPost(p); focusEditor('journal-editor') }} className="text-xs font-bold text-navy underline">Edit</button>
                      <button onClick={() => setPreviewPost(p)} className="text-xs font-bold text-slate-500 underline">Preview</button>
                      <button onClick={() => void togglePostVisibility(p)} className="text-xs font-bold text-ink underline">{p.active ? 'Unpublish' : 'Publish'}</button>
                      <button onClick={() => removePost(p.id)} className="text-xs font-bold text-red-600 underline">Delete</button>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section id="journal-editor" aria-label="Journal post editor" className="min-w-0">
          <form onSubmit={savePostItem} className="min-w-0 overflow-hidden border-t-2 border-ink bg-white p-6">
            <h2 className="font-display text-2xl font-bold">{posts.some((p) => p.id === post.id) ? `Edit ${post.id}` : 'Add a new journal post'}</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="min-w-0 text-sm font-bold">Id (slug, auto-generated from title if blank)<input value={post.id} onChange={(e) => updatePost('id', e.target.value)} className={`mt-2 w-full ${inputClass}`} placeholder="e.g. esp32-beginner-project" /></label>
              <label className="min-w-0 text-sm font-bold">Tag / category<input value={post.tag} onChange={(e) => updatePost('tag', e.target.value)} className={`mt-2 w-full ${inputClass}`} placeholder="Tutorial · Robotics" /></label>
              <label className="min-w-0 text-sm font-bold sm:col-span-2">Title<input value={post.title} onChange={(e) => updatePost('title', e.target.value)} className={`mt-2 w-full ${inputClass}`} placeholder="Post title" /></label>
              <label className="min-w-0 text-sm font-bold sm:col-span-2">Excerpt / summary<textarea value={post.text} onChange={(e) => updatePost('text', e.target.value)} rows={4} className={`mt-2 w-full ${inputClass}`} placeholder="One or two sentences shown on the journal page." /></label>
              <label className="min-w-0 text-sm font-bold">Sort order<input type="number" value={post.sortOrder} onChange={(e) => updatePost('sortOrder', Number(e.target.value))} className={`mt-2 w-full ${inputClass}`} /></label>
              <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={post.active} onChange={(e) => updatePost('active', e.target.checked)} className="h-4 w-4" /> Published (visible on site + app)</label>
            </div>
            <div className="mt-5 flex gap-3">
              <button type="submit" disabled={busy} className="bg-gold px-5 py-3 text-sm font-black text-ink transition hover:bg-gold-dark disabled:opacity-60">{busy ? 'Saving...' : 'Save post'}</button>
              {post.id && <button type="button" onClick={() => setPost(emptyJournal)} className="border border-line px-5 py-3 text-sm font-black text-ink transition hover:border-navy">New post</button>}
            </div>
          </form>
        </section>
      </div>

      {previewPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-5" role="dialog" aria-modal="true" aria-label="Journal post preview" onClick={() => setPreviewPost(null)}>
          <article className="relative max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-2xl border border-line bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setPreviewPost(null)} className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-ink shadow-sm transition hover:bg-white" aria-label="Close preview">✕</button>
            <div className="p-6">
              <p className="truncate text-xs font-black uppercase tracking-widest text-navy">{previewPost.tag || 'Journal'}</p>
              <h2 className="mt-2 line-clamp-2 font-display text-xl font-bold leading-snug text-ink">{previewPost.title}</h2>
              <p className="mt-2 flex-1 text-sm leading-6 text-muted">{previewPost.text}</p>
              <div className="mt-5 flex items-center justify-between gap-3">
                <strong className="text-[10px] font-black uppercase tracking-widest text-slate-400">{previewPost.active ? 'Published' : 'Hidden'}</strong>
                <button onClick={() => setPreviewPost(null)} className="rounded-full border border-line px-4 py-2 text-xs font-black text-ink transition hover:border-navy">Close</button>
              </div>
            </div>
          </article>
        </div>
      )}
    </>
  )
}
