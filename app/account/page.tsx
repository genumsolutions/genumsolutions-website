import type { Metadata } from 'next'
import PageShell from '../../components/PageShell'
import AccountPanel from '../../components/AccountPanel'

export const metadata: Metadata = { robots: { index: false, follow: false } }

export const dynamic = 'force-dynamic'
export default function AccountPage() { return <PageShell><AccountPanel /></PageShell> }
