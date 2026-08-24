import type { Metadata } from 'next'
import PageShell from '../../components/PageShell'
import AuthPanel from '../../components/AuthPanel'

export const metadata: Metadata = { title: 'Sign in · GENUM SOLUTIONS' }

const modes = ['signin', 'signup', 'forgot'] as const

// ?mode=signup|forgot deep-links (e.g. from marketing CTAs) land on the right tab.
export default function LoginPage({ searchParams }: { searchParams?: { mode?: string } }) {
  const requested = searchParams?.mode as (typeof modes)[number] | undefined
  const initialMode = requested && modes.includes(requested) ? requested : 'signin'
  return <PageShell><AuthPanel initialMode={initialMode} /></PageShell>
}
