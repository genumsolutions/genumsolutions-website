import Link from "next/link";
import type { Metadata } from "next";
import { ArrowUpRight } from "lucide-react";
import ArticleCard from "../../components/ArticleCard";
import ModelBrowser from "../../components/ModelBrowser";
import ModelsCatalog from "../../components/ModelsCatalog";
import ProductCard from "../../components/ProductCard";
import PageShell from "../../components/PageShell";
import PrintCalculator from "../../components/print/PrintCalculator";
import PrintQuoteForm from "../../components/print/PrintQuoteForm";
import {
  PrintCategories,
  PrintCustomServices,
  PrintGallery,
  PrintHero,
  PrintMaterials,
  PrintPromoBanner,
} from "../../components/print/print-sections";
import { company } from "../../lib/company";
import { getManagedProducts } from "../../lib/content-store";
import { applyScope } from "../../lib/catalog";
import { activePromotion, formatNPR } from "../../lib/print";
import { getPrintContent } from "../../lib/print-store";

// U-48: no force-dynamic — statically rendered, revalidated in the background
// (layout `revalidate = 300`). Catalog edits bust the cache on demand via
// revalidateProducts(); print content (categories, rates, promotions, gallery)
// busts it via revalidatePrint() from the admin 3D print routes.

export const metadata: Metadata = {
  title: "3D Printing",
  description:
    "Prototype printing, design for print, and small-batch fabrication in PLA and PETG for makers, students, and product teams in Nepal. Upload a model for a reviewed quote.",
  openGraph: {
    title: "3D Printing · GENUM SOLUTIONS",
    description:
      "Print a catalogue model or send your own design for a reviewed, no-surprise quote.",
  },
};

const offers = [
  {
    title: "Prototype printing",
    text: "Turn a CAD file into a physical test part, enclosure, bracket, or teaching model.",
    meta: "FDM · PLA / PETG",
  },
  {
    title: "Design for print",
    text: "Get help preparing geometry, tolerances, supports, and orientation before material is wasted.",
    meta: "Consultancy · From NPR 2,500",
  },
  {
    title: "Small-batch parts",
    text: "Repeatable print runs for fixtures, replacement parts, classroom sets, and maker products.",
    meta: "Quote by volume",
  },
];

async function getModels() {
  try {
    const products = await getManagedProducts();
    // U-44: the whole "3D Products" scope — the only customer page where
    // 3D models are listed (they are removed from /products entirely).
    return applyScope(products, "models").filter((p) => p.active !== false);
  } catch {
    return [];
  }
}

// U-47 (2026-09-27, owner): the CATALOG still leads. The hero, promotions,
// featured row and service sections were added around it in 2026-11-13; the
// model grid keeps its position immediately after the introduction.
export default async function PrintingPage() {
  const [models, content] = await Promise.all([getModels(), getPrintContent()]);
  const promo = activePromotion(content.promotions);
  const featured = models.filter((model) => model.featuredPrint);
  const counts = models.reduce<Record<string, number>>((acc, model) => {
    const key = model.printCategory ?? "";
    if (key) acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  const pricedMaterials = content.materials.filter((material) => material.ratePerGram > 0);
  const showCalculator = content.settings.calculatorEnabled && pricedMaterials.length > 0;

  return (
    <PageShell>
      <PrintHero settings={content.settings} modelCount={models.length} />
      {promo && <PrintPromoBanner promo={promo} />}

      {featured.length > 0 && (
        <section className="mx-auto max-w-7xl px-5 pt-10 lg:px-8" aria-labelledby="print-featured">
          <p className="text-xs font-black uppercase tracking-[.24em] text-navy">Featured</p>
          <h2 id="print-featured" className="mt-2 font-display text-2xl font-bold sm:text-3xl">
            Featured models.
          </h2>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {/* ProductCard is the shared catalog card; the featured row only
                changes which rows appear, never how they look. */}
            {featured.slice(0, 10).map((model) => (
              <ProductCard key={model.id} product={model} />
            ))}
          </div>
        </section>
      )}

      <section
        id="catalogue"
        className="mx-auto max-w-7xl scroll-mt-24 px-5 py-8 lg:px-8"
        aria-label="3D Products catalogue"
      >
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[.24em] text-navy">
              Ready-to-print catalogue
            </p>
            <h2 className="mt-2 font-display text-2xl font-bold sm:text-3xl">
              Pick a model, we print it.
            </h2>
          </div>
          <Link
            href="#quote"
            className="text-sm font-black text-navy underline-offset-4 hover:underline"
          >
            Have your own file? Send it instead
          </Link>
        </div>
        <ModelsCatalog products={models} />
      </section>

      <PrintCategories categories={content.categories} counts={counts} />
      <PrintMaterials materials={content.materials} intro={content.settings.materialsIntro} />

      {showCalculator ? (
        <PrintCalculator settings={content.settings} materials={content.materials} />
      ) : (
        <section className="mx-auto max-w-7xl px-5 pt-10 lg:px-8" aria-labelledby="print-pricing">
          <div className="grid gap-6 rounded-2xl border border-line bg-white p-6 sm:p-8 lg:grid-cols-[1fr_.9fr]">
            <div>
              <p className="text-xs font-black uppercase tracking-[.24em] text-navy">Pricing</p>
              <h2 id="print-pricing" className="mt-2 font-display text-2xl font-bold sm:text-3xl">
                Every quote is checked by a person.
              </h2>
              <p className="mt-3 text-sm leading-6 text-muted">
                Cost depends on the material, the printed weight, supports, orientation and finish.
                Send the file and we will come back with a firm figure — including the minimum order
                of {formatNPR(content.settings.minimumOrder)}.
              </p>
            </div>
            <dl className="grid content-start gap-3 text-sm">
              <div className="flex items-start justify-between gap-4 rounded-xl bg-mist px-4 py-3">
                <dt className="text-muted">Minimum order</dt>
                <dd className="font-black text-ink">{formatNPR(content.settings.minimumOrder)}</dd>
              </div>
              <div className="flex items-start justify-between gap-4 rounded-xl bg-mist px-4 py-3">
                <dt className="text-muted">Design base charge</dt>
                <dd className="font-black text-ink">
                  {content.settings.designBaseCharge > 0
                    ? formatNPR(content.settings.designBaseCharge)
                    : "On request"}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4 rounded-xl bg-mist px-4 py-3">
                <dt className="text-muted">Material rate</dt>
                <dd className="font-black text-ink">Confirmed in your quote</dd>
              </div>
            </dl>
          </div>
        </section>
      )}

      <PrintCustomServices />

      <section className="mx-auto max-w-7xl px-5 pt-10 lg:px-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {offers.map((offer) => (
            <ArticleCard
              key={offer.title}
              tag={offer.meta}
              title={offer.title}
              description={offer.text}
              href="#quote"
              cta="Request a quote"
            />
          ))}
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <div className="mt-10 grid gap-6 border-y border-line py-8 sm:gap-8 lg:grid-cols-[.8fr_1.2fr]">
          <div>
            <p className="text-xs font-black uppercase tracking-[.24em] text-navy">The workflow</p>
            <h2 className="mt-3 font-display text-2xl font-bold sm:text-3xl">
              A useful loop, not a mystery box.
            </h2>
          </div>
          <ol className="grid gap-4 sm:grid-cols-2">
            <li className="border-l-2 border-gold pl-4">
              <strong>01 · Share</strong>
              <p className="mt-1 text-sm leading-6 text-muted">
                Send an STL, STEP, sketch, or reference.
              </p>
            </li>
            <li className="border-l-2 border-gold pl-4">
              <strong>02 · Review</strong>
              <p className="mt-1 text-sm leading-6 text-muted">
                We check fit, material, supports, and finish.
              </p>
            </li>
            <li className="border-l-2 border-gold pl-4">
              <strong>03 · Print</strong>
              <p className="mt-1 text-sm leading-6 text-muted">
                You approve the estimate before the machine starts.
              </p>
            </li>
            <li className="border-l-2 border-gold pl-4">
              <strong>04 · Learn</strong>
              <p className="mt-1 text-sm leading-6 text-muted">
                Get the part plus notes for the next iteration.
              </p>
            </li>
          </ol>
        </div>
      </div>

      <PrintQuoteForm materials={content.materials} />
      <PrintGallery items={content.gallery} />

      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <ModelBrowser />

        <div className="mt-10 mb-10 flex flex-col gap-5 rounded-2xl bg-ink p-6 text-white sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-7">
          <div>
            <p className="text-xs font-black uppercase tracking-[.24em] text-gold">Have a file?</p>
            <h2 className="mt-2 font-display text-xl font-bold sm:text-2xl">
              Let us review the first print.
            </h2>
          </div>
          <Link
            href="#quote"
            className="inline-flex h-12 shrink-0 items-center gap-1.5 rounded-full bg-gold px-5 text-sm font-black text-ink transition hover:bg-gold-dark"
          >
            Request a print review <ArrowUpRight size={14} aria-hidden="true" />
          </Link>
        </div>
      </div>

      <script
        type="application/ld+json"
        // Service + offer catalogue, not a product review claim.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Service",
            name: "3D Printing Services",
            description:
              "FDM 3D printing, design for print, and small-batch fabrication in PLA and PETG.",
            serviceType: "3D printing",
            areaServed: { "@type": "Country", name: "Nepal" },
            provider: {
              "@type": "Organization",
              name: company.name,
              url: company.url,
              email: company.email,
            },
            offers: {
              "@type": "Offer",
              availability: "https://schema.org/InStock",
              priceCurrency: "NPR",
              url: `${company.url}/3d-printing`,
              description: "Quoted per model after review.",
            },
            hasOfferCatalog: {
              "@type": "OfferCatalog",
              name: "3D print categories",
              itemListElement: content.categories.map((category) => ({
                "@type": "Offer",
                itemOffered: { "@type": "Service", name: category.name },
              })),
            },
          }),
        }}
      />
    </PageShell>
  );
}
