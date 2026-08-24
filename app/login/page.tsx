import PageShell from '../../components/PageShell'
import AuthPanel from '../../components/AuthPanel'

export default function LoginPage() {
  return <PageShell><AuthPanel initialMode="signin" /></PageShell>
}
