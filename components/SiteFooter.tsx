import Image from "next/image";
import Link from "next/link";
import { getCompany } from "../lib/company-store";
import { socialLinks, whatsappLink } from "../lib/socials";
import NewsletterOptIn from "./NewsletterOptIn";

const exploreLinks = [
  { href: "/products", label: "Shop & Kits" },
  { href: "/projects", label: "Projects" },
  { href: "/app", label: "Download the app" },
  { href: "/tools", label: "Tools" },
  { href: "/3d-printing", label: "3D Printing" },
  { href: "/services", label: "Services & Training" },
];

const companyLinks = [
  { href: "/about", label: "About us" },
  { href: "/journal", label: "Journal" },
  { href: "/contact", label: "Contact" },
  { href: "/account", label: "My account" },
];

const supportLinks = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Service" },
];

export default async function SiteFooter() {
  // Business contact details come from the shared company_info table (cached),
  // with the bundled copy as fallback - edits in the DB show here on both clients.
  const company = await getCompany();
  const cols =
    "grid grid-cols-2 gap-x-6 gap-y-6 px-5 py-6 sm:gap-8 sm:py-8 lg:grid-cols-[1.5fr_1fr_1fr_1.3fr] lg:px-8";
  const heading = "text-[11px] font-black uppercase tracking-[.2em] text-white/30";

  return (
    <footer className="border-t border-line bg-ink text-white">
      <div className={`${cols} mx-auto max-w-7xl`}>
        {/* Brand */}
        <div className="col-span-2 lg:col-span-1">
          <Link href="/" className="flex items-center gap-3" aria-label="GENUM SOLUTIONS home">
            <span className="relative block h-11 w-11 shrink-0 overflow-hidden rounded-full bg-white ring-1 ring-white/20 sm:h-14 sm:w-14">
              <Image
                src="/logo.png"
                alt="GENUM SOLUTIONS stamp"
                width={112}
                height={112}
                className="h-full w-full object-contain"
                priority
              />
            </span>
            <span aria-hidden="true" className="hidden h-10 w-px bg-white/20 sm:block" />
            <span className="leading-none">
              <strong className="block font-display text-lg font-bold tracking-tight text-white sm:text-[22px]">
                GENUM
              </strong>
              <span className="mt-1 block text-[9px] font-bold uppercase tracking-[0.32em] text-white/60 sm:text-[10px]">
                Solutions Pvt.&thinsp;Ltd.
              </span>
            </span>
          </Link>{" "}
          <p className="mt-3 max-w-sm text-sm leading-5 text-white/60 sm:mt-4 sm:text-base sm:leading-6">
            Robotics, electronics, AI, IoT, 3D printing, digital products, and practical technology
            training from Kathmandu, Nepal.
          </p>
          {/* C5 (2026-09-23): socials + WhatsApp — admin-editable, hidden when unset. */}
          {(socialLinks(company).length > 0 || company.whatsappNumber) && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {socialLinks(company).map((link) => (
                <a
                  key={link.key}
                  href={link.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-label={`${link.label} (opens in a new tab)`}
                  className="inline-flex min-h-9 items-center rounded-full border border-white/20 px-3 py-1.5 text-[11px] font-black uppercase tracking-wide text-white/70 transition hover:border-gold hover:text-gold"
                >
                  {link.label}
                </a>
              ))}
              {company.whatsappNumber && (
                <a
                  href={whatsappLink(
                    company.whatsappNumber,
                    "Hi GENUM Solutions! I have a question."
                  )}
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-label="Chat on WhatsApp (opens in a new tab)"
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-emerald-700 px-3 py-1.5 text-[11px] font-black uppercase tracking-wide text-white transition hover:bg-emerald-600"
                >
                  WhatsApp
                </a>
              )}
            </div>
          )}
        </div>

        {/* Explore */}
        <nav aria-label="Explore" className="text-sm text-white/60">
          <h2 className={heading}>Explore</h2>
          <ul className="mt-4 space-y-2.5">
            {exploreLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="inline-flex min-h-9 items-center transition hover:text-gold"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Company */}
        <nav aria-label="Company" className="text-sm text-white/60">
          <h2 className={heading}>Company</h2>
          <ul className="mt-4 space-y-2.5">
            {companyLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="inline-flex min-h-9 items-center transition hover:text-gold"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Get in touch — W2b (F3): fills the full row on phones (brand first,
            then nav columns, then contact), desktop spans the last column. */}
        <div className="col-span-2 text-sm text-white/60 lg:col-span-1">
          <h2 className={heading}>Get in touch</h2>
          <address className="mt-4 space-y-2 not-italic">
            <p>{company.address}</p>
            <p>
              <a
                href={`tel:${company.phone.replace(/\s/g, "")}`}
                className="inline-flex min-h-9 items-center transition hover:text-gold"
              >
                {company.phone}
              </a>
            </p>
            <p>
              <a
                href={`mailto:${company.email}`}
                className="inline-flex min-h-9 items-center transition hover:text-gold"
              >
                {company.email}
              </a>
            </p>
          </address>
          {/* C4 (2026-09-23): newsletter opt-in (consent checkbox required). */}
          <div className="mt-6">
            <h2 className={heading}>Newsletter</h2>
            <p className="mt-3 text-xs leading-5 text-white/50">
              New kits, projects, and training — straight to your inbox.
            </p>
            <NewsletterOptIn variant="footer" />
          </div>
          <p className="mt-4 text-xs leading-5 text-white/40">
            Payments: eSewa · Khalti · Cash on delivery
          </p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
            {supportLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="inline-flex min-h-9 items-center text-white/40 underline-offset-2 transition hover:text-gold hover:underline"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-wrap justify-between gap-2 px-5 py-3 text-[11px] text-white/30 sm:gap-3 sm:py-4 sm:text-xs lg:px-8">
          <span>
            © 2026 {company.name} · PAN {company.pan}
          </span>
          <span>Built in Kathmandu, delivered across Nepal.</span>
        </div>
      </div>
    </footer>
  );
}
