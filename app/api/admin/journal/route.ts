import { NextResponse } from 'next/server'
import { isAdminRequest } from '../../../../lib/admin'
import {
  deleteJournalPost,
  getManagedJournalPosts,
  saveJournalPost,
} from '../../../../lib/journal-store'
import type { ManagedJournalPost } from '../../../../lib/journal-store'

export async function GET(request: Request) {
  if (!(await isAdminRequest())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const params = new URL(request.url).searchParams
    const all = await getManagedJournalPosts()
    const needle = (params.get('q') || '').trim().toLowerCase()
    const filtered = needle
      ? all.filter((post) =>
          `${post.id} ${post.title} ${post.tag} ${post.text}`.toLowerCase().includes(needle),
        )
      : all
    const page = Math.max(1, Number(params.get('page')) || 1)
    const limit = Math.min(100, Math.max(5, Number(params.get('limit')) || 20))
    return NextResponse.json({
      posts: filtered.slice((page - 1) * limit, page * limit),
      total: filtered.length,
      page,
      totalPages: Math.max(1, Math.ceil(filtered.length / limit)),
    })
  } catch (error) {
    console.error('Admin journal list failed', error)
    return NextResponse.json({ error: 'Could not load journal posts.' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  return save(request)
}

export async function PUT(request: Request) {
  return save(request)
}

async function save(request: Request) {
  if (!(await isAdminRequest())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = (await request.json().catch(() => null)) as ManagedJournalPost | null
    if (!body?.title || !body?.title.trim()) {
      return NextResponse.json({ error: 'Journal title is required.' }, { status: 400 })
    }
    const id = body.id?.trim() || slugify(body.title)
    const post: ManagedJournalPost = {
      id,
      tag: (body.tag || '').trim(),
      title: body.title.trim(),
      text: (body.text || '').trim(),
      active: body.active !== false,
      sortOrder: Math.max(0, Math.round(Number(body.sortOrder) || 0)),
    }
    await saveJournalPost(post)
    return NextResponse.json({ ok: true, post })
  } catch (error) {
    console.error('Journal save failed', error)
    return NextResponse.json({ error: 'Could not save the journal post.' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  if (!(await isAdminRequest())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const id = new URL(request.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Journal post id is required.' }, { status: 400 })
    await deleteJournalPost(id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Journal deletion failed', error)
    return NextResponse.json({ error: 'Could not delete the journal post.' }, { status: 500 })
  }
}

function slugify(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}
