import type { Metadata } from 'next'
import PageShell from '../../components/PageShell'
import type { Company } from '../../lib/company'
import { getCompany } from '../../lib/company-store'

export async function generateMetadata(): Promise<Metadata> {
  const company = await getCompany()
  return {
    title: 'Terms of Service',
    description: `Terms for buying kits, project packages, and training from ${company.shortName}, including payments, delivery, warranty, and returns.`,
    alternates: { canonical: '/terms' },
  }
}

function Agreement({ company }: { company: Company }) {
  return <p>By ordering from this website you agree to these terms with {company.name} ({company.address}, PAN {company.pan}).</p>
}

function OrdersAndPricing() {
  return (
    <ul className="list-disc space-y-1 pl-5">
      <li>All prices are in Nepali Rupees (NPR) and include applicable taxes unless stated otherwise.</li>
      <li>An order is a request to buy; it becomes binding when we confirm it by email or dispatch the goods.</li>
      <li>Project packages and training marked &quot;quote&quot; are priced individually after scoping.</li>
    </ul>
  )
}

function Payments() {
  return (
    <ul className="list-disc space-y-1 pl-5">
      <li>We accept eSewa, Khalti, and cash on delivery inside Kathmandu Valley.</li>
      <li>Online orders are charged at checkout. COD orders are payable in full on delivery.</li>
      <li>Failed or cancelled online payments leave the order unpaid; nothing is reserved until payment succeeds.</li>
    </ul>
  )
}

function Delivery() {
  return (
    <ul className="list-disc space-y-1 pl-5">
      <li>In-stock items usually dispatch within 1–2 working days.</li>
      <li>Kathmandu Valley delivery is free above NPR 5,000; elsewhere courier charges apply and are confirmed before shipping.</li>
      <li>Risk passes to you on delivery. Inspect packages before signing where possible.</li>
    </ul>
  )
}

function WarrantyAndReturns() {
  return (
    <ul className="list-disc space-y-1 pl-5">
      <li>Retail components carry a 7-day replacement warranty for manufacturing defects.</li>
      <li>Returns require original packaging and proof of purchase; contact us first for an authorisation.</li>
      <li>Physical damage, water damage, burnt boards, or misuse void the warranty.</li>
      <li>Digital products (curricula, files) are non-returnable once downloaded.</li>
    </ul>
  )
}

function TrainingPrograms() {
  return <p>Workshop dates may shift for reasons beyond our control; we will reschedule rather than cancel where possible. School pilot agreements are governed by the signed proposal document.</p>
}

function AcceptableUse() {
  return <p>Do not attempt to breach site security, scrape at scale, resell curricula without licence, or place fraudulent orders.</p>
}

function Liability() {
  return <p>To the extent permitted by law, our liability for any claim is limited to the amount you paid for the affected order.</p>
}

function ChangesAndLaw() {
  return <p>We may update these terms; the version in force is the one published when you order. These terms are governed by the laws of Nepal, courts of Kathmandu.</p>
}

export default async function TermsPage() {
  const company = await getCompany()

  const sections = [
    { title: 'Agreement', Body: () => <Agreement company={company} /> },
    { title: 'Orders and pricing', Body: OrdersAndPricing },
    { title: 'Payments', Body: Payments },
    { title: 'Delivery', Body: Delivery },
    { title: 'Warranty and returns', Body: WarrantyAndReturns },
    { title: 'Training programs', Body: TrainingPrograms },
    { title: 'Acceptable use', Body: AcceptableUse },
    { title: 'Liability', Body: Liability },
    { title: 'Changes and governing law', Body: ChangesAndLaw },
  ]
  return (
    <PageShell>
      <main className="mx-auto max-w-3xl px-5 py-10 sm:py-16 lg:px-8">
        <p className="text-xs font-black uppercase tracking-[.24em] text-navy">Legal</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">Terms of Service</h1>
        <p className="mt-2 text-sm text-slate-500">Last updated: August 2026</p>
        <div className="mt-10 space-y-8 text-sm leading-7 text-slate-600">
          {sections.map(({ title, Body }) => (
            <section key={title}>
              <h2 className="font-display text-xl font-bold text-ink">{title}</h2>
              <div className="mt-2"><Body /></div>
            </section>
          ))}
        </div>
      </main>
    </PageShell>
  )
}
