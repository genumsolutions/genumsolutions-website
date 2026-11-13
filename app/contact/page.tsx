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
  const socials = socialLinks(company);
  const hasEmailOrPhone = Boolean(company.email || company.phone);
  return (
    <PageShell>
      <PageIntro
        eyebrow="Contact"
        title="Bring the half-formed idea."
        body="Tell us what you are trying to make. We will help turn the interesting parts into a clear next step."
      />
      <section className="mx-auto grid max-w-7xl gap-8 px-5 py-10 sm:gap-10 sm:py-14 lg:grid-cols-2 lg:px-8">
        <div className="min-w-0">
          {/* The form used to start at the "Name" label with no heading, so the
              left column had no label while the right one did. */}
          <h2 className="font-display text-2xl font-bold tracking-tight text-ink">
            Send a message.
          </h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-muted">
            Include the project, quantity or deadline if you have one — it shortens the first reply.
          </p>
          <div className="mt-6">
            <ContactForm />
          </div>
        </div>
        <div className="min-w-0 rounded-2xl border border-line bg-white p-5 sm:p-6">
          <p className="text-xs font-black uppercase tracking-[.24em] text-navy">Direct lines</p>
          <p className="mt-3 text-sm font-bold text-ink">{company.name}</p>
          {company.address ? <p className="mt-2 leading-7 text-muted">{company.address}</p> : null}
          {/* An empty company_info row used to render two blank lines where the
              email and phone belonged. */}
          {hasEmailOrPhone ? (
            <p className="mt-5 text-sm font-bold text-navy">
              {company.email}
              {company.email && company.phone ? <br /> : null}
              {company.phone}
            </p>
          ) : (
            <p className="mt-5 text-sm leading-6 text-muted">
              Email and phone are being updated — the form above reaches the same team.
            </p>
          )}
          {/* C5 (2026-09-23): WhatsApp chat + socials, admin-editable. */}
          {company.whatsappNumber ? (
            <a
              href={whatsappLink(company.whatsappNumber, "Hi GENUM Solutions! I have a question.")}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-emerald-700 px-4 py-2 text-xs font-black uppercase tracking-wide text-white transition hover:bg-emerald-600"
            >
              Chat on WhatsApp
            </a>
          ) : null}
          {socials.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-sm font-bold text-navy">
              {socials.map((link) => (
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
          ) : null}
        </div>
      </section>
    </PageShell>
  );
}
