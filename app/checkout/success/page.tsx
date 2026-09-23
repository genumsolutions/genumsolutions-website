import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { getCompany } from "../../../lib/company-store";
import { socialLinks, whatsappLink } from "../../../lib/socials";
import SuccessPanel from "./SuccessPanel";

// C5 (2026-09-23): this page is a server component so the WhatsApp nudge can
// read the shared company row (admin-editable socials). The payment
// confirmation logic stays client-side in SuccessPanel (extracted verbatim).
export default async function CheckoutSuccessPage() {
  const company = await getCompany();
  const waHref = company.whatsappNumber
    ? whatsappLink(company.whatsappNumber, "Hi GENUM Solutions! I just placed an order.")
    : "";
  const socials = socialLinks(company);

  return (
    <main className="min-h-screen bg-mist">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
          <Link
            href="/"
            className="group flex shrink-0 items-center gap-2.5"
            aria-label="GENUM SOLUTIONS home"
          >
            <span className="relative block h-9 w-9 shrink-0 overflow-hidden rounded-full bg-white shadow-card ring-1 ring-line transition group-hover:ring-navy/40 sm:h-11 sm:w-11">
              <Image
                src="/logo.png"
                alt="GENUM SOLUTIONS stamp"
                width={112}
                height={112}
                className="h-full w-full object-contain"
                priority
              />
            </span>
            <span className="leading-none">
              <strong className="block font-display text-base font-bold tracking-tight text-ink sm:text-lg">
                GENUM
              </strong>
              <span className="mt-0.5 block text-[8px] font-bold uppercase tracking-[0.3em] text-navy sm:text-[9px]">
                Solutions Pvt.&thinsp;Ltd.
              </span>
            </span>
          </Link>
          <Link href="/products" className="text-sm font-bold text-navy hover:underline">
            Continue shopping
          </Link>
        </div>
      </header>
      <div className="grid min-h-[70vh] place-items-center px-5">
        <Suspense
          fallback={<div className="font-display text-xl font-bold text-slate-500">Loading...</div>}
        >
          <SuccessPanel />
        </Suspense>
        {(waHref || socials.length > 0) && (
          <div className="mt-6 text-center">
            <p className="text-xs text-slate-500">Questions about your order?</p>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
              {waHref && (
                <a
                  href={waHref}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2 text-xs font-black uppercase tracking-wide text-white transition hover:bg-emerald-500"
                >
                  Chat on WhatsApp
                </a>
              )}
              {socials.map((link) => (
                <a
                  key={link.key}
                  href={link.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-label={`${link.label} (opens in a new tab)`}
                  className="rounded-full border border-line bg-white px-4 py-2 text-xs font-black uppercase tracking-wide text-slate-600 transition hover:border-navy hover:text-navy"
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
