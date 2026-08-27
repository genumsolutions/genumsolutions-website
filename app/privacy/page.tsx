import type { Metadata } from 'next'
import PageShell from '../../components/PageShell'
import { company } from '../../lib/company'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: `How ${company.shortName} collects, uses, and protects your personal data for orders, accounts, and inquiries.`,
  alternates: { canonical: '/privacy' },
}

function WhoWeAre() {
  return (
    <p>
      {company.name} ({company.address}, PAN {company.pan}) operates this website and is the controller of the personal
      data described below. Questions:{' '}
      <a className="text-navy underline" href={`mailto:${company.email}`}>{company.email}</a>.
    </p>
  )
}

function DataWeCollect() {
  return (
    <ul className="list-disc space-y-1 pl-5">
      <li><strong>Account data:</strong> name, email, and password (hashed by our authentication provider) when you create an account.</li>
      <li><strong>Profile data:</strong> phone number and delivery address you add for order fulfilment.</li>
      <li><strong>Order &amp; payment data:</strong> items ordered, amounts, delivery details, and a payment reference from the gateway. We never see or store your full card numbers or eSewa/Khalti credentials.</li>
      <li><strong>Messages:</strong> content you send through contact forms.</li>
      <li><strong>Technical data:</strong> standard server logs (IP address, user agent) kept briefly for security.</li>
    </ul>
  )
}

function HowWeUseIt() {
  return (
    <ul className="list-disc space-y-1 pl-5">
      <li>To create and manage your account and saved cart.</li>
      <li>To process orders, payments, deliveries, and refunds.</li>
      <li>To reply to inquiries and send service emails about your orders.</li>
      <li>To keep the site secure and prevent abuse.</li>
    </ul>
  )
}

function PaymentProcessors() {
  return <p>Payments run through eSewa and Khalti under their own privacy policies. They receive only what is needed to complete the transaction.</p>
}

function Sharing() {
  return <p>We share data only with payment gateways and delivery couriers as needed to fulfil your order, and with authorities where the law requires. We do not sell personal data.</p>
}

function Retention() {
  return <p>Order records are kept for tax and accounting purposes as required by Nepali law. You can delete your account at any time; we will remove profile data except records we must retain by law.</p>
}

function YourRights() {
  return <p>You may request access to, correction of, or deletion of your personal data by emailing us. Individual Privacy Act 2018 (Nepal) rights apply.</p>
}

function Cookies() {
  return <p>We use a session cookie for sign-in, a cart cookie/localStorage entry, and an optional theme preference stored locally. No advertising trackers.</p>
}

const sections = [
  { title: 'Who we are', Body: WhoWeAre },
  { title: 'Data we collect', Body: DataWeCollect },
  { title: 'How we use it', Body: HowWeUseIt },
  { title: 'Payment processors', Body: PaymentProcessors },
  { title: 'Sharing', Body: Sharing },
  { title: 'Retention', Body: Retention },
  { title: 'Your rights', Body: YourRights },
  { title: 'Cookies', Body: Cookies },
]

export default function PrivacyPage() {
  return (
    <PageShell>
      <main className="mx-auto max-w-3xl px-5 py-10 sm:py-16 lg:px-8">
        <p className="text-xs font-black uppercase tracking-[.24em] text-navy">Legal</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">Privacy Policy</h1>
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
