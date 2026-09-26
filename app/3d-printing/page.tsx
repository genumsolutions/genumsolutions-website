import Link from "next/link";
import type { Metadata } from "next";
import { ArrowUpRight } from "lucide-react";
import ArticleCard from "../../components/ArticleCard";
import PageIntro from "../../components/PageIntro";
import PageShell from "../../components/PageShell";
import ModelBrowser from "../../components/ModelBrowser";
import ModelsCatalog from "../../components/ModelsCatalog";
import { getManagedProducts } from "../../lib/content-store";
import { applyScope } from "../../lib/catalog";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "3D Printing",
  description:
    "Prototype printing, design for print, and small-batch fabrication for makers, students, and product teams in Nepal.",
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

export default async function PrintingPage() {
  const models = await getModels();
  return (
    <PageShell>
      <PageIntro
        eyebrow="3D printing · new vertical"
        title="From a sketch to a thing you can hold."
        body="GENUM is adding print-to-order fabrication for Nepal makers, students, product teams, and classrooms. Start with a file, a reference object, or a rough idea."
      />

      <section className="mx-auto max-w-7xl px-5 py-10 sm:py-14 lg:px-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {offers.map((offer) => (
            <ArticleCard
              key={offer.title}
              tag={offer.meta}
              title={offer.title}
              description={offer.text}
              href="/contact"
              cta="Request a quote"
            />
          ))}
        </div>

        <section
          className="mt-12 border-t border-line pt-8 sm:mt-14 sm:pt-10"
          aria-label="3D Products catalogue"
        >
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[.24em] text-navy">
                Print-to-order catalogue
              </p>
              <h2 className="mt-2 font-display text-2xl font-bold sm:text-3xl">
                3D Products — printed on demand.
              </h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-muted">
              Popular community models we can print on demand. Want something else? Send us the link
              - we price it and print it.
            </p>
          </div>
          <div className="mt-6">
            <ModelsCatalog products={models} />
          </div>
        </section>

        <div className="mt-10 grid gap-6 border-y border-line py-8 sm:mt-12 sm:gap-8 sm:py-10 lg:grid-cols-[.8fr_1.2fr]">
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

        <ModelBrowser />

        <div className="mt-10 flex flex-col gap-5 rounded-2xl bg-ink p-6 text-white sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-7">
          <div>
            <p className="text-xs font-black uppercase tracking-[.24em] text-gold">Have a file?</p>
            <h2 className="mt-2 font-display text-xl font-bold sm:text-2xl">
              Let us review the first print.
            </h2>
          </div>
          <Link
            href="/contact"
            className="inline-flex h-12 shrink-0 items-center gap-1.5 rounded-full bg-gold px-5 text-sm font-black text-ink transition hover:bg-gold-dark"
          >
            Request a print review <ArrowUpRight size={14} aria-hidden="true" />
          </Link>
        </div>
      </section>
    </PageShell>
  );
}
