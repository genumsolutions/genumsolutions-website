import type { Metadata } from 'next'
import PageShell from '../../components/PageShell'
import AppDownloadClient from '../../components/AppDownloadClient'
import { getCompany } from '../../lib/company-store'
import { getLiveAppInfo } from '../../lib/company'

export const metadata: Metadata = {
  title: 'Android App',
  description: 'Download the GENUM Solutions Android app for browsing, orders, tools, and Robo Car device controls.',
}

export const dynamic = 'force-dynamic'

export default async function AppDownloadPage() {
  // Company brand/contact details come from the shared company_info table.
  const company = await getCompany()
  // App version/size come straight from the live release.json manifest so the
  // first paint is always the actually-uploaded release — never a future build.
  const appInfo = await getLiveAppInfo()
  return (
    <PageShell>
      <AppDownloadClient company={company} initial={appInfo} />
    </PageShell>
  )
}
