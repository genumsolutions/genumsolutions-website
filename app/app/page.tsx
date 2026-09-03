import type { Metadata } from 'next'
import PageShell from '../../components/PageShell'
import AppDownloadClient from '../../components/AppDownloadClient'
import { getCompany } from '../../lib/company-store'

export const metadata: Metadata = {
  title: 'Android App',
  description: 'Download the GENUM Solutions Android app for browsing, orders, tools, and Robo Car device controls.',
}

export default async function AppDownloadPage() {
  // Company brand/contact details come from the shared company_info table.
  const company = await getCompany()
  return (
    <PageShell>
      <AppDownloadClient company={company} />
    </PageShell>
  )
}
