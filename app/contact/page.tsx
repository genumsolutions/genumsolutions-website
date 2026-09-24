import type { Metadata } from "next";
import PageIntro from "../../components/PageIntro";
import PageShell from "../../components/PageShell";
import ContactForm from "../../components/ContactForm";
import { getCompany } from "../../lib/company-store";
import { socialLinks, whatsappLink } from "../../lib/socials";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Get in touch for projects, quotes, training, and support from GENUM Solutions in Kathmandu, Nepal.",
};

export default async function ContactPage() {
  // Contact details come from the shared company_info table (cached fallback bundled).
  const company = await getCompany();
  return (
    <PageShell>
      <PageIntro
        eyebrow="Contact"
        title="Bring the half-formed idea."
        body="Tell us what you are trying to make. We will help turn the interesting parts into a clear next step."
      />
      <section className="mx-auto grid max-w-7xl gap-8 px-5 py-10 sm:gap-10 sm:py-14 lg:grid-cols-2 lg:px-8">
        <ContactForm />
        <div className="border-t-2 border-ink pt-5">
          <p className="text-sm font-bold">{company.name}</p>
          <p className="mt-3 leading-7 text-muted">{company.address}</p>
          <p className="mt-5 text-sm font-bold text-navy">
            {company.email}
            <br />
            {company.phone}
          </p>
          {/* C5 (2026-09-23): WhatsApp chat + socials, admin-editable. */}
          {company.whatsappNumber && (
            <a
              href={whatsappLink(company.whatsappNumber, "Hi GENUM Solutions! I have a question.")}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-emerald-700 px-4 py-2 text-xs font-black uppercase tracking-wide text-white transition hover:bg-emerald-600"
            >
              Chat on WhatsApp
            </a>
          )}
          {socialLinks(company).length > 0 && (
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-sm font-bold text-navy">
              {socialLinks(company).map((link) => (
                <a
                  key={link.key}
                  href={link.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="transition hover:text-navy-dark hover:underline"
                >
                  {link.label} ↗
                </a>
              ))}
            </div>
          )}
        </div>
      </section>
    </PageShell>
  );
}
