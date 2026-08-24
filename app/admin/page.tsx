import { redirect } from 'next/navigation'
import Link from 'next/link'
import { isAdminRequest } from '../../lib/admin'
import { getManagedProducts, getSiteContent } from '../../lib/content-store'
import AdminPanel from '../../components/AdminPanel'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  if (!(await isAdminRequest())) redirect('/login')
  const [products, content] = await Promise.all([getManagedProducts(), getSiteContent()])
  return <main className="min-h-screen bg-mist"><header className="border-b border-line bg-white"><div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 lg:px-8"><div><Link href="/" className="text-sm font-black text-cobalt">GENUM SOLUTIONS</Link><h1 className="mt-2 font-display text-3xl font-bold text-ink">Content workspace</h1></div><form action="/api/admin/logout" method="post"><button className="border border-line px-4 py-2 text-sm font-bold text-ink">Log out</button></form></div></header><AdminPanel initialProducts={products} initialContent={content} /></main>
}
