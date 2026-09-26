import Link from "next/link";
import NextImage from "next/image";
import type { Metadata } from "next";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import PageShell from "../components/PageShell";
import HeroCarousel from "../components/HeroCarousel";
import ProductCard from "../components/ProductCard";
import { getProductMedia } from "../lib/product-media";
import { getTrainingPrograms, getPilotCosts, getCurriculumHighlights } from "../lib/programs-store";
import { getManagedProducts } from "../lib/content-store";
import { getSiteContent } from "../lib/content-store";
import { applyScope } from "../lib/catalog";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const content = await getSiteContent();
  return {
    title: content.homeTitle,
    description: content.homeBody,
    alternates: { canonical: "/" },
    openGraph: {
      title: content.homeTitle,
      description: content.homeBody,
      url: "/",
      type: "website",
      siteName: "GENUM SOLUTIONS",
      locale: "en_NP",
      images: [
        { url: "/logo.png", width: 512, height: 512, alt: "GENUM SOLUTIONS official stamp" },
      ],
    },
    twitter: {
      card: "summary",
      title: content.homeTitle,
      description: content.homeBody,
      images: ["/logo.png"],
    },
  };
}

const services = [
  {
    title: "Robotics kits & components",
    body: "Controllers, motors, sensors, and full robot-car platforms sourced and tested in Kathmandu.",
    href: "/products",
    cta: "Browse catalog",
  },
  {
    title: "3D & 2D printing",
    body: "Prototypes, spare parts, and signage printed to spec with materials advice included.",
    href: "/3d-printing",
    cta: "Printing services",
  },
  {
    title: "School STEM packages",
    body: "Kits, curriculum, teacher training, and coaching bundled into a single pilot program.",
    href: "/services#training",
    cta: "See programs",
  },
  {
    title: "Custom projects & labs",
    body: "IoT, AI prototypes, workshop setups, and lab consultation delivered end to end.",
    href: "/services",
    cta: "Start a proposal",
  },
];

const stats = [
  ["100+", "Curriculum projects"],
  ["4", "Payment options incl. COD"],
  ["1–2", "Day dispatch in Nepal"],
  ["7-day", "Component replacement"],
];

// U-38e (2026-09-25): the home page only mentioned 3D printing as one text
// card in the services grid (owner snag A1). Mirrors the /3d-printing offers
// so the vertical is a first-class section on the home page.
const printingOffers = [
  {
    title: "Prototype printing",
    text: "Turn a CAD file into a physical test part, enclosure, or teaching model.",
  },
  {
    title: "Design for print",
    text: "Geometry, tolerances, supports, and orientation reviewed before material is wasted.",
  },
  {
    title: "Small-batch parts",
    text: "Repeatable runs for fixtures, replacement parts, classroom sets, and maker products.",
  },
];

export default async function HomePage() {
  // Training programs, curriculum highlights, and pilot costing all render
  // from the shared DB tables (the SAME source the app's Home screen reads)
  // with the bundled lists as fallback — one company story on both surfaces.
  // U-38e: printing models come from the same "3D Models" catalog rows the
  // /3d-printing page shows, so the home strip never drifts from the vertical.
  const [trainingPrograms, pilotCosts, curriculum, printModels, featuredElectronic] =
    await Promise.all([
      getTrainingPrograms(),
      getPilotCosts(),
      getCurriculumHighlights(),
      getManagedProducts()
        .then((products) =>
          products.filter(
            (p) => p.category?.trim().toLowerCase() === "3d models" && p.active !== false
          )
        )
        .catch(() => []),
      // U-46: in-stock electronic products with photos for the hero carousel
      // (most-updated-first is not exposed on Product — stable name order).
      getManagedProducts()
        .then((products) =>
          applyScope(products, "components")
            .filter((p) => p.active !== false && p.stock > 0 && Boolean(p.image))
            .sort((a, b) => a.name.localeCompare(b.name))
        )
        .catch(() => []),
    ]);
  const printShowcase = printModels.slice(0, 4);
  // U-46: hero carousel slides — the newest 3D prints + electronic products
  // (already fetched above for the strips; no extra DB round-trip).
  const heroProducts = [...printModels.slice(0, 2), ...featuredElectronic.slice(0, 2)];
  // U-47 (owner, ecommerce-style home): an in-stock products strip right
  // under the hero — mixed 3D + electronic, photo-led, straight to the page.
  const bestSellers = [
    ...printModels.filter((p) => Boolean(p.image)).slice(0, 4),
    ...featuredElectronic.slice(0, 4),
  ].slice(0, 8);

  return (
    <PageShell>
      <main>
        <section className="grid-paper border-b border-line">
          <div className="mx-auto grid max-w-7xl items-center gap-8 px-5 py-12 sm:py-16 lg:grid-cols-[1.1fr_.9fr] lg:gap-14 lg:px-8 lg:py-24">
            <div>
              <p className="mb-4 flex items-center gap-2 text-xs font-black uppercase tracking-[.24em] text-navy sm:mb-5">
                <span className="h-2 w-2 rounded-full bg-gold" aria-hidden="true" /> Kathmandu ·
                Nepal
              </p>
              <h1 className="max-w-3xl font-display text-3xl font-bold leading-[1.1] tracking-[-.03em] text-ink sm:text-4xl sm:leading-[1.05] lg:text-6xl lg:leading-[.98]">
                Technology you can <span className="text-navy">touch</span>, test, and trust.
              </h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-slate-600 sm:mt-7 sm:text-lg">
                Robotics kits, project solutions, fabrication, open tools, and training for curious
                builders, schools, and teams — designed in Kathmandu, delivered across Nepal, with
                eSewa, Khalti, card, and cash-on-delivery payment.
              </p>
              <div className="mt-7 flex flex-wrap gap-3 sm:mt-9">
                <Link
                  href="/products"
                  className="inline-flex h-12 items-center rounded-full bg-navy px-6 text-sm font-bold text-white shadow-sm transition hover:bg-navy-dark hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
                >
                  Get started
                </Link>
                <Link
                  href="/contact"
                  className="inline-flex h-12 items-center rounded-full border border-line bg-white px-6 text-sm font-black text-ink transition hover:border-navy hover:text-navy focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
                >
                  Contact us
                </Link>
              </div>
              <dl className="mt-10 grid grid-cols-2 gap-x-4 gap-y-5 border-t border-line pt-8 sm:mt-12 sm:grid-cols-4 sm:gap-x-6">
                {stats.map(([value, label]) => (
                  <div key={label}>
                    <dt className="order-last mt-1 text-xs leading-5 text-slate-500">{label}</dt>
                    <dd className="font-display text-2xl font-bold text-ink">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
            {/* U-46: the hero image is now a carousel — brand statement +
                real featured products, auto-advancing. */}
            <HeroCarousel products={heroProducts} />
          </div>
        </section>

        {/* U-47: shop-first strip — the products, immediately. */}
        {bestSellers.length > 0 && (
          <section
            aria-labelledby="bestsellers-heading"
            className="border-b border-line bg-white py-12 lg:py-16"
          >
            <div className="mx-auto max-w-7xl px-5 lg:px-8">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[.24em] text-navy">
                    In stock now
                  </p>
                  <h2
                    id="bestsellers-heading"
                    className="mt-2 font-display text-2xl font-bold tracking-tight sm:text-3xl"
                  >
                    Shop what&apos;s on the shelf.
                  </h2>
                </div>
                <Link
                  href="/products"
                  className="inline-flex items-center gap-1.5 text-sm font-bold text-navy underline decoration-gold decoration-2 underline-offset-4 transition hover:text-navy-dark"
                >
                  All electronic products <ArrowRight size={15} aria-hidden="true" />
                </Link>
              </div>
              <ul className="mt-8 grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
                {bestSellers.map((model) => (
                  <li key={model.id}>
                    <ProductCard product={model} />
                  </li>
                ))}
              </ul>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/3d-printing"
                  className="text-sm font-bold text-navy underline decoration-gold decoration-2 underline-offset-4 hover:text-navy-dark"
                >
                  Browse 3D prints
                </Link>
                <Link
                  href="/projects"
                  className="text-sm font-bold text-navy underline decoration-gold decoration-2 underline-offset-4 hover:text-navy-dark"
                >
                  Browse projects
                </Link>
              </div>
            </div>
          </section>
        )}

        <section
          aria-labelledby="printing-heading"
          className="border-y border-line bg-mist py-12 lg:py-20"
        >
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[.24em] text-navy">
                  3D & 2D printing · new vertical
                </p>
                <h2
                  id="printing-heading"
                  className="mt-2 font-display text-2xl font-bold tracking-tight sm:text-3xl"
                >
                  From a sketch to a thing you can hold.
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">
                  Print-to-order fabrication for makers, students, product teams, and classrooms.
                  Start with a file, a reference object, or a rough idea.
                </p>
              </div>
              <Link
                href="/3d-printing"
                className="inline-flex items-center gap-1.5 text-sm font-bold text-navy underline decoration-gold decoration-2 underline-offset-4 transition hover:text-navy-dark"
              >
                Visit printing services <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {printingOffers.map((offer) => (
                <div
                  key={offer.title}
                  className="rounded-2xl border border-line bg-white p-5 sm:p-6"
                >
                  <h3 className="font-display text-base font-bold leading-snug">{offer.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{offer.text}</p>
                </div>
              ))}
            </div>

            {printShowcase.length > 0 && (
              <div className="mt-8">
                <h3 className="font-display text-lg font-bold">Models we print</h3>
                <ul className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {printShowcase.map((model) => {
                    const media = model.image ?? getProductMedia(model.category).src;
                    return (
                      <li key={model.id}>
                        <Link
                          href={`/products/${model.id}`}
                          className="group block overflow-hidden rounded-2xl border border-line bg-white transition hover:-translate-y-0.5 hover:border-navy hover:shadow-lg"
                        >
                          <span className="relative block aspect-square bg-mist">
                            {model.image ? (
                              <NextImage
                                src={media}
                                alt={model.name}
                                fill
                                sizes="(max-width: 640px) 50vw, 25vw"
                                className="object-contain transition duration-500 group-hover:scale-105"
                              />
                            ) : null}
                          </span>
                          <span className="block p-3">
                            <span className="line-clamp-1 block font-display text-xs font-bold text-ink">
                              {model.name}
                            </span>
                            <span className="mt-1 flex items-center justify-between gap-2">
                              <span className="text-xs font-bold text-navy">
                                {model.priceLabel}
                              </span>
                              <ArrowUpRight
                                size={13}
                                aria-hidden="true"
                                className="text-slate-400 transition group-hover:text-navy"
                              />
                            </span>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            <Link
              href="/contact"
              className="mt-8 inline-flex h-12 items-center gap-2 rounded-full bg-navy px-6 text-sm font-black text-white transition hover:bg-navy-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
            >
              Send a file for a print review <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
        </section>

        <section
          aria-labelledby="services-heading"
          className="mx-auto max-w-7xl px-5 py-12 lg:px-8 lg:py-20"
        >
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[.24em] text-navy">
                What GENUM does
              </p>
              <h2
                id="services-heading"
                className="mt-2 font-display text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl"
              >
                A practical build partner.
              </h2>
            </div>
            <Link
              href="/services"
              className="inline-flex items-center gap-1.5 text-sm font-bold text-navy underline decoration-gold decoration-2 underline-offset-4 transition hover:text-navy-dark"
            >
              View all services <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {services.map((service) => (
              <article
                key={service.title}
                className="flex flex-col rounded-2xl border border-line bg-white p-5 transition hover:-translate-y-0.5 hover:border-navy hover:shadow-lg sm:p-6"
              >
                <h3 className="font-display text-lg font-bold leading-snug">{service.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">{service.body}</p>
                <Link
                  href={service.href}
                  className="mt-4 inline-flex items-center gap-1.5 text-sm font-black text-navy transition hover:gap-2.5"
                  aria-label={`${service.cta}: ${service.title}`}
                >
                  {service.cta} <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="training-heading" className="py-12 lg:py-20">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[.24em] text-navy">
                  100+ project curriculum
                </p>
                <h2
                  id="training-heading"
                  className="mt-2 font-display text-2xl font-bold tracking-tight sm:text-3xl"
                >
                  Training programs that build careers.
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">
                  From a single robotics lab to a three-classroom pilot with kits, curriculum,
                  teacher training, coaching, and reporting.
                </p>
              </div>
              <Link
                href="/services#training"
                className="inline-flex items-center gap-1.5 text-sm font-bold text-navy underline decoration-gold decoration-2 underline-offset-4 transition hover:text-navy-dark"
              >
                View all programs <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </div>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {trainingPrograms.map((program) => (
                <li
                  key={program.title}
                  className="flex flex-col rounded-2xl border border-line bg-white p-5 sm:p-6"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-display text-base font-bold leading-snug">
                      {program.title}
                    </h3>
                    <span className="shrink-0 whitespace-nowrap rounded-full bg-sky px-3 py-1 text-[10px] font-bold text-navy">
                      {program.duration}
                    </span>
                  </div>
                  <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-gold">
                    {program.audience}
                  </p>
                  <p className="mt-3 flex-1 text-xs leading-5 text-slate-600">
                    {program.description}
                  </p>
                  <p className="mt-3 text-[10px] leading-4 text-slate-500">
                    <strong className="text-ink">Outcome:</strong> {program.outcome}
                  </p>
                </li>
              ))}
            </ul>
            {curriculum.length > 0 && (
              <div className="mt-10">
                <h3 className="font-display text-lg font-bold">Curriculum highlights</h3>
                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {curriculum.map((band) => (
                    <div
                      key={band.ageBand}
                      className="rounded-2xl border border-line bg-white p-5 sm:p-6"
                    >
                      <h4 className="font-display text-base font-bold text-ink">{band.ageBand}</h4>
                      <ul className="mt-3 space-y-1.5">
                        {band.items.map((item) => (
                          <li
                            key={item}
                            className="flex items-start gap-2 text-xs leading-5 text-slate-600"
                          >
                            <span
                              className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-gold"
                              aria-hidden="true"
                            />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <Link
              href="/services"
              className="mt-7 inline-flex h-12 items-center gap-2 rounded-full bg-navy px-6 text-sm font-black text-white transition hover:bg-navy-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
            >
              See all services & training <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
        </section>

        <section
          aria-labelledby="pilots-heading"
          className="border-y border-line bg-mist py-12 lg:py-20"
        >
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <div className="grid gap-8 lg:grid-cols-[.9fr_1.1fr] lg:gap-12">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[.24em] text-navy">
                  Illustrative pilot costing
                </p>
                <h2
                  id="pilots-heading"
                  className="mt-2 font-display text-2xl font-bold tracking-tight sm:text-3xl"
                >
                  A transparent starting point for a school proposal.
                </h2>
                <p className="mt-4 text-sm leading-6 text-slate-600">
                  The source proposal models a three-classroom pilot with 30 kits. These figures are
                  illustrative, shown in NPR for planning, and confirmed after scope, taxes,
                  delivery, and local procurement review.
                </p>
                {pilotCosts.length > 0 && (
                  <div className="mt-6 flex flex-wrap items-center gap-3">
                    <Link
                      href="/services#pilots"
                      className="inline-flex h-12 items-center gap-2 rounded-full bg-gold px-6 text-sm font-black text-ink transition hover:bg-gold-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                    >
                      Request a school proposal <ArrowRight size={15} aria-hidden="true" />
                    </Link>
                    <Link
                      href="/contact"
                      className="inline-flex h-12 items-center rounded-full border border-line bg-white px-6 text-sm font-black text-ink transition hover:border-navy hover:text-navy focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
                    >
                      Talk to us
                    </Link>
                  </div>
                )}
              </div>
              {pilotCosts.length > 0 && (
                <div className="min-w-0">
                  <div className="rounded-2xl border border-line bg-white">
                    {/* W2b (F1): the costing table clips at 360px — scroll it on
                        phones instead of truncating rows. */}
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[420px] text-left text-sm">
                        <caption className="sr-only">
                          Illustrative pilot program running costs
                        </caption>
                        <thead>
                          <tr className="border-b border-line bg-mist text-[10px] uppercase tracking-wide text-slate-500">
                            <th scope="col" className="px-5 py-3 font-bold">
                              Item
                            </th>
                            <th scope="col" className="px-5 py-3 font-bold">
                              Cost
                            </th>
                            <th scope="col" className="hidden px-5 py-3 font-bold sm:table-cell">
                              Notes
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                          {pilotCosts.map((line) => (
                            <tr key={line.item}>
                              <th scope="row" className="px-5 py-3 font-semibold text-ink">
                                {line.item}
                              </th>
                              <td className="px-5 py-3 font-mono text-xs text-ink">{line.cost}</td>
                              <td className="hidden px-5 py-3 text-xs leading-5 text-slate-600 sm:table-cell">
                                {line.note}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="border-t border-line bg-mist px-5 py-2.5 text-[10px] text-slate-500">
                      Illustrative figures — final pilot quotes are customised per school.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="border-t border-line bg-ink">
          <div className="mx-auto grid max-w-7xl gap-6 px-5 py-12 text-white sm:grid-cols-1 sm:items-center sm:py-14 lg:grid-cols-[1fr_auto] lg:px-8">
            <div>
              <p className="text-xs font-black uppercase tracking-[.24em] text-gold">
                Need a starting point?
              </p>
              <h2 className="mt-2 max-w-xl font-display text-2xl font-bold tracking-tight sm:text-3xl">
                Use the open tools or bring us the brief.
              </h2>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/tools"
                className="inline-flex h-12 items-center rounded-full bg-white px-6 text-sm font-black text-ink transition hover:bg-mist focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Open tools
              </Link>
              <Link
                href="/contact"
                className="inline-flex h-12 items-center rounded-full border border-white/40 px-6 text-sm font-black text-white transition hover:border-white hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Contact GENUM
              </Link>
            </div>
          </div>
        </section>
      </main>
    </PageShell>
  );
}
