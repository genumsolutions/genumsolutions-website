import type { Metadata } from 'next'
import PageShell from '../../components/PageShell'
import ResetPasswordPanel from '../../components/ResetPasswordPanel'

export const metadata: Metadata = { robots: { index: false, follow: false } }

export default function ResetPasswordPage() { return <PageShell><ResetPasswordPanel /></PageShell> }
