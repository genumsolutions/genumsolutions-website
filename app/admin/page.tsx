import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import dynamicImport from 'next/dynamic'
import { getCurrentAdmin } from '../../lib/admin'
import { getManagedProducts } from '../../lib/content-store'
import LogoutButton from '../../components/LogoutButton'

const AdminPanel = dynamicImport(() => import('../../components/AdminPanel'), { ssr: false, loading: () => <div className="mx-auto max-w-7xl px-5 py-12 text-sm text-muted">Loading admin…</div> })

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Admin · GENUM SOLUTIONS' }

export default async function AdminPage() {
  const [admin, products] = await Promise.all([getCurrentAdmin(), getManagedProducts()])
  if (!admin) redirect('/login')
  return (
    <main className="min-h-screen bg-mist">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5 lg:px-8">
          <div>
            <Link href="/" className="text-sm font-black text-cobalt">GENUM SOLUTIONS</Link>
            <h1 className="mt-2 font-display text-3xl font-bold text-ink">Admin Dashboard</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden max-w-[14rem] truncate rounded-full bg-cobalt-light px-4 py-2 text-xs font-bold text-cobalt sm:block" title={admin.email}>{admin.email}</span>
            <LogoutButton className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink transition hover:border-red-300 hover:text-red-600" />
          </div>
        </div>
      </header>
      <AdminPanel initialProducts={products} />
    </main>
  )
}
