import type { Metadata } from 'next'
import PageIntro from '../../components/PageIntro'
import PageShell from '../../components/PageShell'
import ContactForm from '../../components/ContactForm'
import { company } from '../../lib/company'

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Get in touch for projects, quotes, training, and support from GENUM Solutions in Kathmandu, Nepal.',
}

export default function ContactPage() {
  return (
    <PageShell>
      <PageIntro
        eyebrow="Contact"
        title="Bring the half-formed idea."
        body="Tell us what you are trying to make. We will help turn the interesting parts into a clear next step."
      />
      <section className="mx-auto grid max-w-7xl gap-10 px-5 py-14 lg:grid-cols-2 lg:px-8">
        <ContactForm />
        <div className="border-t-2 border-ink pt-5">
          <p className="text-sm font-bold">{company.name}</p>
          <p className="mt-3 leading-7 text-muted">{company.address}</p>
          <p className="mt-5 text-sm font-bold text-navy">{company.email}<br />{company.phone}</p>
        </div>
      </section>
    </PageShell>
  )
}
