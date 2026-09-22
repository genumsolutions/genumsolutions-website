'use client'

import { useEffect, useState } from 'react'
import { inputClass } from '../../lib/styles'
import type { UserPage } from './admin-types'
import { PAGE_SIZE } from './admin-types'
import { Pager } from './admin-helpers'

type Props = { setMessage: (msg: string) => void }

// One robot preference row (user × robot) from robot_user_settings.
type RobotRow = { robot_id: string; robot_name: string; settings: Record<string, unknown>; updated_at: string }

// Expandable per-user engineering manager: tier toggle + the user's robot
// preference rows (code values / parameters / telemetry channels), kept in
// the dedicated robot_user_settings table — never mixed with orders/carts.
function UserRobotManager({ userId, email, setMessage }: { userId: string; email: string; setMessage: (msg: string) => void }) {
  const [robots, setRobots] = useState<RobotRow[] | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const [draftJson, setDraftJson] = useState('')
  const [newRobotId, setNewRobotId] = useState('')
  const [busy, setBusy] = useState(false)

  async function load() {
    const response = await fetch('/api/admin/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'listRobotSettings', userId }) })
    if (response.ok) {
      const data = await response.json()
      setRobots(data.robots || [])
    } else setRobots([])
  }

  useEffect(() => { setRobots(null); void load() }, [userId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function send(action: string, extra: Record<string, unknown>, successNote: string) {
    setBusy(true)
    const response = await fetch('/api/admin/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, userId, ...extra }) })
    const body = await response.json().catch(() => ({}))
    setBusy(false)
    if (response.ok) { setMessage(successNote); void load() } else setMessage(body.error || 'Action failed.')
  }

  function startEdit(robot: RobotRow) {
    setEditingId(robot.robot_id)
    setDraftName(robot.robot_name)
    setDraftJson(JSON.stringify(robot.settings ?? {}, null, 2))
  }

  async function saveEdit() {
    if (!editingId) return
    let settings: unknown
    try { settings = JSON.parse(draftJson || '{}') } catch { setMessage('Settings must be valid JSON.'); return }
    await send('upsertRobotSetting', { robotId: editingId, robotName: draftName, settings }, `Robot settings saved for ${email}.`)
    setEditingId(null)
  }

  return (
    <div className="mt-3 w-full rounded-xl border border-line bg-surface p-4">
      <p className="text-xs font-black uppercase tracking-widest text-navy">Robot preference profiles</p>
      <p className="mt-1 text-xs text-slate-500">Per-robot code values, parameters, and telemetry channels — stored separately from orders/carts. The app reads the same rows.</p>
      {robots === null ? (
        <p className="mt-3 text-xs text-slate-500" role="status">Loading…</p>
      ) : robots.length === 0 ? (
        <p className="mt-3 text-xs text-slate-500">No robot profiles for this user yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {robots.map((robot) => (
            <li key={robot.robot_id} className="rounded-lg border border-line bg-white p-3">
              {editingId === robot.robot_id ? (
                <div>
                  <input value={draftName} onChange={(e) => setDraftName(e.target.value)} placeholder="Robot display name" aria-label="Robot display name" className={`w-full text-xs ${inputClass}`} />
                  <textarea value={draftJson} onChange={(e) => setDraftJson(e.target.value)} rows={6} aria-label="Settings JSON" className={`mt-2 w-full font-mono text-xs ${inputClass}`} />
                  <div className="mt-2 flex gap-2">
                    <button onClick={() => void saveEdit()} disabled={busy} className="rounded-full bg-navy px-4 py-1.5 text-xs font-black text-white disabled:opacity-60">Save</button>
                    <button onClick={() => setEditingId(null)} className="rounded-full border border-line px-4 py-1.5 text-xs font-bold text-ink">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-ink">{robot.robot_name || robot.robot_id} <span className="font-mono font-normal text-slate-400">· {robot.robot_id}</span></p>
                    <p className="truncate font-mono text-[11px] text-slate-500">{Object.keys(robot.settings || {}).length} keys · updated {new Date(robot.updated_at).toLocaleDateString()}</p>
                  </div>
                  <span className="flex gap-2">
                    <button onClick={() => startEdit(robot)} className="rounded-full border border-line px-3 py-1 text-xs font-bold text-navy transition hover:border-navy">Edit</button>
                    <button onClick={() => { if (window.confirm(`Delete the ${robot.robot_name || robot.robot_id} profile for ${email}?`)) void send('deleteRobotSetting', { robotId: robot.robot_id }, 'Robot profile deleted.') }} className="rounded-full border border-red-200 px-3 py-1 text-xs font-bold text-red-600 transition hover:bg-red-50">Delete</button>
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="text-xs font-bold text-slate-500">
          Add robot by id
          <input value={newRobotId} onChange={(e) => setNewRobotId(e.target.value)} placeholder="e.g. 2wd1m-basic" aria-label="New robot id" className={`mt-1 w-48 text-xs ${inputClass}`} />
        </label>
        <button
          onClick={() => {
            const robotId = newRobotId.trim()
            if (!robotId) { setMessage('Enter a robot id first.'); return }
            void send('upsertRobotSetting', { robotId, robotName: robotId, settings: {} }, `Robot profile "${robotId}" created for ${email}.`)
            setNewRobotId('')
          }}
          disabled={busy}
          className="rounded-full border border-line px-4 py-2 text-xs font-bold text-navy transition hover:border-navy disabled:opacity-60"
        >
          Add profile
        </button>
      </div>
    </div>
  )
}

export default function AdminUsers({ setMessage }: Props) {
  const [userData, setUserData] = useState<UserPage & { users: (UserPage['users'][number] & { tier?: string })[] }>({ users: [], page: 1, hasMore: false })
  const [loaded, setLoaded] = useState(false)
  const [userQuery, setUserQuery] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void loadUsers(1) }, [])

  async function loadUsers(page: number) {
    setLoaded(false)
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
      if (userQuery.trim()) params.set('q', userQuery.trim())
      const response = await fetch(`/api/admin/users?${params}`)
      if (response.ok) setUserData(await response.json())
    } finally { setLoaded(true) }
  }

  async function setUserRole(userId: string, role: 'admin' | 'customer') {
    const verb = role === 'admin' ? 'grant admin to' : 'revoke admin from'
    if (!window.confirm(`Are you sure you want to ${verb} this user?`)) return
    const response = await fetch('/api/admin/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, role }) })
    if (response.ok) {
      setUserData((current) => ({ ...current, users: current.users.map((user) => user.id === userId ? { ...user, role } : user) }))
      setMessage(role === 'admin' ? 'Admin access granted.' : 'Admin access revoked.')
    } else {
      // Surface the server's reason (e.g. the self-demotion guard) instead of a generic failure.
      const result = await response.json().catch(() => ({}))
      setMessage(result.error || 'Could not update the role.')
    }
  }

  async function setUserTier(userId: string, tier: 'free' | 'pro') {
    const verb = tier === 'pro' ? 'upgrade to Pro (Remote window + robot preferences unlock)' : 'downgrade to Free'
    if (!window.confirm(`Are you sure you want to ${verb} this user?`)) return
    const response = await fetch('/api/admin/users', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, tier }) })
    if (response.ok) {
      setUserData((current) => ({ ...current, users: current.users.map((user) => user.id === userId ? { ...user, tier } : user) }))
      setMessage(tier === 'pro' ? 'User upgraded to Pro.' : 'User downgraded to Free.')
    } else {
      const result = await response.json().catch(() => ({}))
      setMessage(result.error || 'Could not update the tier.')
    }
  }

  return (
    <section role="tabpanel" id="panel-users" aria-labelledby="tab-users" aria-label="User management" className="mt-8 space-y-4">
      <div className="flex flex-col gap-3 border-t-2 border-ink bg-white p-6 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <h2 className="font-display text-xl font-bold">Users</h2>
        <label className="ml-auto text-sm font-bold text-slate-500">Search
          <input value={userQuery} onChange={(e) => setUserQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void loadUsers(1)} placeholder="email or name" aria-label="Search users" className={`mt-1 w-full sm:ml-2 sm:mt-0 sm:w-56 ${inputClass}`} />
        </label>
        <button onClick={() => void loadUsers(1)} className="bg-navy px-4 py-2 text-xs font-black text-white transition hover:bg-navy-dark">Apply</button>
      </div>
      {!loaded ? <p className="text-sm text-slate-500" role="status">Loading…</p> : userData.users.length === 0 ? <p className="text-sm text-slate-500">No users found.</p> : (
        <>
          <ul className="space-y-3">
            {userData.users.map((user) => (
              <li key={user.id} className="border border-line bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{user.name || '—'} <span className="font-normal text-slate-500">· {user.email}</span></p>
                    {user.phone && <p className="text-xs text-slate-400">{user.phone}</p>}
                    {user.address && <p className="break-words text-xs text-slate-400">{user.address}</p>}
                    <p className="text-xs text-slate-400">Joined {new Date(user.createdAt).toLocaleDateString()}{user.lastSignInAt ? ` · Last seen ${new Date(user.lastSignInAt).toLocaleDateString()}` : ''}</p>
                    <span className="mt-1 flex flex-wrap gap-1">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${user.role === 'admin' ? 'bg-gold text-ink' : 'bg-sky text-navy'}`}>{user.role}</span>
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${user.tier === 'pro' ? 'bg-navy text-white' : 'bg-slate-100 text-slate-500'}`}>{user.tier === 'pro' ? 'Pro' : 'Free'}</span>
                    </span>
                  </div>
                  <span className="flex shrink-0 flex-wrap gap-2">
                    {user.role === 'admin'
                      ? <button onClick={() => setUserRole(user.id, 'customer')} className="border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600 transition hover:bg-red-50">Revoke admin</button>
                      : <button onClick={() => setUserRole(user.id, 'admin')} className="border border-line px-3 py-1.5 text-xs font-bold text-navy transition hover:border-navy">Make admin</button>}
                    {user.tier === 'pro'
                      ? <button onClick={() => setUserTier(user.id, 'free')} className="border border-line px-3 py-1.5 text-xs font-bold text-slate-500 transition hover:border-slate-500">Downgrade to Free</button>
                      : <button onClick={() => setUserTier(user.id, 'pro')} className="border border-navy bg-navy-light px-3 py-1.5 text-xs font-bold text-navy transition hover:bg-navy hover:text-white">Upgrade to Pro</button>}
                    <button
                      onClick={() => setExpandedId((current) => current === user.id ? null : user.id)}
                      aria-expanded={expandedId === user.id}
                      className="border border-line px-3 py-1.5 text-xs font-bold text-ink transition hover:border-navy"
                    >
                      {expandedId === user.id ? 'Hide profiles' : 'Robot profiles'}
                    </button>
                  </span>
                </div>
                {expandedId === user.id && <UserRobotManager userId={user.id} email={user.email} setMessage={setMessage} />}
              </li>
            ))}
          </ul>
          <Pager page={userData.page} totalPages={userData.page + (userData.hasMore ? 1 : 0)} onPage={(page) => void loadUsers(page)} />
        </>
      )}
    </section>
  )
}
