'use client'

import { useEffect, useState } from 'react'
import { inputClass } from '../../lib/styles'
import type { UserPage } from './admin-types'
import { PAGE_SIZE } from './admin-types'
import { Pager } from './admin-helpers'

type Props = { setMessage: (msg: string) => void }

export default function AdminUsers({ setMessage }: Props) {
  const [userData, setUserData] = useState<UserPage>({ users: [], page: 1, hasMore: false })
  const [loaded, setLoaded] = useState(false)
  const [userQuery, setUserQuery] = useState('')

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
    } else setMessage('Could not update the role.')
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
              <li key={user.id} className="flex flex-wrap items-center justify-between gap-3 border border-line bg-white p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{user.name || '—'} <span className="font-normal text-slate-500">· {user.email}</span></p>
                  {user.phone && <p className="text-xs text-slate-400">{user.phone}</p>}
                  {user.address && <p className="break-words text-xs text-slate-400">{user.address}</p>}
                  <p className="text-xs text-slate-400">Joined {new Date(user.createdAt).toLocaleDateString()}{user.lastSignInAt ? ` · Last seen ${new Date(user.lastSignInAt).toLocaleDateString()}` : ''}</p>
                  <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${user.role === 'admin' ? 'bg-gold text-ink' : 'bg-sky text-navy'}`}>{user.role}</span>
                </div>
                <span className="flex shrink-0 gap-2">
                  {user.role === 'admin'
                    ? <button onClick={() => setUserRole(user.id, 'customer')} className="border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600 transition hover:bg-red-50">Revoke admin</button>
                    : <button onClick={() => setUserRole(user.id, 'admin')} className="border border-line px-3 py-1.5 text-xs font-bold text-navy transition hover:border-navy">Make admin</button>}
                </span>
              </li>
            ))}
          </ul>
          <Pager page={userData.page} totalPages={userData.page + (userData.hasMore ? 1 : 0)} onPage={(page) => void loadUsers(page)} />
        </>
      )}
    </section>
  )
}
