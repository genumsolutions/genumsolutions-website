import type { Metadata } from 'next'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import dynamicImport from 'next/dynamic'
import { getCurrentAdmin } from '../../lib/admin'
import { getManagedProducts } from '../../lib/content-store'
import LogoutButton from '../../components/LogoutButton'

const AdminPanel = dynamicImport(() => import('../../components/AdminPanel'), { ssr: false, loading: () => <div className="mx-auto max-w-7xl px-5 py-12 text-sm text-muted">Loading admin…</div> })

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Admin' }

export default async function AdminPage() {
  const [admin, products] = await Promise.all([getCurrentAdmin(), getManagedProducts()])
  if (!admin) redirect('/login')
  return (
    <main className="min-h-screen bg-mist">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5 lg:px-8">
          <div>
            <Link href="/" className="group flex shrink-0 items-center gap-3" aria-label="GENUM SOLUTIONS home">
              <span className="relative block h-11 w-11 shrink-0 overflow-hidden rounded-full bg-white shadow-card ring-1 ring-line transition group-hover:ring-navy/40 sm:h-14 sm:w-14">
                <Image src="/logo.png" alt="GENUM SOLUTIONS stamp" width={112} height={112} className="h-full w-full object-contain" priority />
              </span>
              <span aria-hidden="true" className="hidden h-10 w-px bg-line sm:block" />
              <span className="leading-none">
                <strong className="block font-display text-lg font-bold tracking-tight text-ink sm:text-[22px]">GENUM</strong>
                <span className="mt-1 block text-[9px] font-bold uppercase tracking-[0.32em] text-navy sm:text-[10px]">Solutions Pvt.&thinsp;Ltd.</span>
              </span>
            </Link>
            <h1 className="mt-3 font-display text-3xl font-bold text-ink">Admin Dashboard</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden max-w-[14rem] truncate rounded-full bg-navy-light px-4 py-2 text-xs font-bold text-navy sm:block" title={admin.email}>{admin.email}</span>
            <LogoutButton className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink transition hover:border-red-300 hover:text-red-600" />
          </div>
        </div>
      </header>
      <AdminPanel initialProducts={products} />
    </main>
  )
}
