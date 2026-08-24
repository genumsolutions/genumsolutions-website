import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCurrentAdmin } from '../../lib/admin'
import { getManagedProducts, getSiteContent } from '../../lib/content-store'
import AdminPanel from '../../components/AdminPanel'
import LogoutButton from '../../components/LogoutButton'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Admin · GENUM SOLUTIONS' }

export default async function AdminPage() {
  const admin = await getCurrentAdmin()
  if (!admin) redirect('/login')
  const [products, content] = await Promise.all([getManagedProducts(), getSiteContent()])
  return (
    <main className="min-h-screen bg-mist">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5 lg:px-8">
          <div>
            <Link href="/" className="text-sm font-black text-cobalt">GENUM SOLUTIONS</Link>
            <h1 className="mt-2 font-display text-3xl font-bold text-ink">Content workspace</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden max-w-[14rem] truncate rounded-full bg-sky px-4 py-2 text-xs font-bold text-cobalt sm:block" title={admin.email}>{admin.email}</span>
            <LogoutButton className="border border-line px-4 py-2 text-sm font-bold text-ink hover:border-red-300 hover:text-red-600" />
          </div>
        </div>
      </header>
      <AdminPanel initialProducts={products} initialContent={content} />
    </main>
  )
}
