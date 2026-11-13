import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Check } from "lucide-react";
import { promotionBadge } from "../../lib/print";
import type {
  PrintCategory,
  PrintGalleryItem,
  PrintMaterial,
  PrintPromotion,
  PrintSettings,
} from "../../lib/print";

// Server-rendered storefront sections for /3d-printing. Every piece of copy
// here is either admin-editable (settings/categories/materials/promotions) or
// generic service description — no invented reviews, counts or projects.

export function PrintHero({
  settings,
  modelCount,
}: {
  settings: PrintSettings;
  modelCount: number;
}) {
  return (
    <section className="border-b border-line bg-mist">
      <div className="mx-auto grid max-w-7xl items-center gap-8 px-5 py-10 sm:px-6 lg:grid-cols-[1.15fr_.85fr] lg:px-8 lg:py-14">
        <div>
          <p className="text-xs font-black uppercase tracking-[.24em] text-navy">
            3D Printing · Fabrication
          </p>
          <h1 className="mt-3 font-display text-3xl font-bold leading-[1.05] tracking-[-.04em] text-ink sm:text-4xl lg:text-5xl">
            From a file on your screen to a part in your hand.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
            Print a model from our catalogue, or send your own design for a reviewed quote. We check
            the geometry, recommend a material, and confirm the price before the machine starts.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="#quote"
              className="inline-flex h-12 items-center gap-1.5 rounded-full bg-navy px-6 text-sm font-black text-white transition hover:bg-navy-dark"
            >
              Request a print quote <ArrowUpRight size={14} aria-hidden="true" />
            </Link>
            <Link
              href="#catalogue"
              className="inline-flex h-12 items-center rounded-full border border-line bg-white px-6 text-sm font-black text-ink transition hover:border-navy"
            >
              {modelCount > 0 ? `Browse ${modelCount} models` : "Browse models"}
            </Link>
          </div>
          <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm font-bold text-slate-600">
            <li className="inline-flex items-center gap-2">
              <Check size={15} className="text-emerald-600" aria-hidden="true" /> FDM in PLA and
              PETG
            </li>
            <li className="inline-flex items-center gap-2">
              <Check size={15} className="text-emerald-600" aria-hidden="true" /> Price confirmed
              after review
            </li>
            <li className="inline-flex items-center gap-2">
              <Check size={15} className="text-emerald-600" aria-hidden="true" /> Design support
              available
            </li>
          </ul>
        </div>
        {settings.heroImage ? (
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-line bg-white">
            <Image
              src={settings.heroImage}
              alt="3D printing at GENUM Solutions"
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 40vw"
              className="object-cover"
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function PrintPromoBanner({ promo }: { promo: PrintPromotion }) {
  const badge = promotionBadge(promo);
  return (
    <section className="mx-auto max-w-7xl px-5 pt-6 lg:px-8" aria-label="Current offer">
      <div className="flex flex-col gap-4 rounded-2xl border border-gold/40 bg-gold/10 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          {badge && (
            <p className="text-xs font-black uppercase tracking-[.24em] text-gold-dark">{badge}</p>
          )}
          <h2 className="mt-1 font-display text-lg font-bold text-ink sm:text-xl">{promo.title}</h2>
          {promo.body && <p className="mt-1 text-sm leading-6 text-slate-700">{promo.body}</p>}
        </div>
        {promo.ctaLabel && promo.ctaHref && (
          <Link
            href={promo.ctaHref}
            className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-ink px-5 text-sm font-black text-white transition hover:bg-navy"
          >
            {promo.ctaLabel} <ArrowUpRight size={14} aria-hidden="true" />
          </Link>
        )}
      </div>
    </section>
  );
}

export function PrintCategories({
  categories,
  counts,
}: {
  categories: PrintCategory[];
  counts: Record<string, number>;
}) {
  if (categories.length === 0) return null;
  return (
    <section className="mx-auto max-w-7xl px-5 pt-10 lg:px-8" aria-labelledby="print-categories">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[.24em] text-navy">What we print</p>
          <h2 id="print-categories" className="mt-2 font-display text-2xl font-bold sm:text-3xl">
            Find the closest fit.
          </h2>
        </div>
        <Link
          href="#quote"
          className="text-sm font-black text-navy underline-offset-4 hover:underline"
        >
          Not sure which one fits? Ask us
        </Link>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {categories.map((category) => (
          <article
            key={category.id}
            className="flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-sm"
          >
            {category.image ? (
              <div className="relative aspect-[16/9] w-full bg-mist">
                <Image
                  src={category.image}
                  alt={category.name}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  className="object-cover"
                />
              </div>
            ) : (
              <div className="h-1.5 w-full bg-gradient-to-r from-navy to-gold" aria-hidden="true" />
            )}
            <div className="flex flex-1 flex-col p-4">
              <h3 className="font-display text-base font-bold text-ink">{category.name}</h3>
              <p className="mt-1 flex-1 text-sm leading-6 text-muted">{category.description}</p>
              <p className="mt-3 text-xs font-black uppercase tracking-wider text-navy">
                {(counts[category.id] ?? 0) > 0
                  ? `${counts[category.id]} in catalogue`
                  : "Request a quote"}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function PrintMaterials({
  materials,
  intro,
}: {
  materials: PrintMaterial[];
  intro: string;
}) {
  return (
    <section className="mx-auto max-w-7xl px-5 pt-10 lg:px-8" aria-labelledby="print-materials">
      <div className="grid gap-6 border-y border-line py-8 lg:grid-cols-[.8fr_1.2fr]">
        <div>
          <p className="text-xs font-black uppercase tracking-[.24em] text-navy">Materials</p>
          <h2 id="print-materials" className="mt-2 font-display text-2xl font-bold sm:text-3xl">
            PLA or PETG — picked for the job.
          </h2>
          <p className="mt-3 text-sm leading-6 text-muted">{intro}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {materials.map((material) => (
            <article key={material.id} className="rounded-2xl border border-line bg-white p-5">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-display text-lg font-bold text-ink">{material.name}</h3>
                <span className="text-xs font-black uppercase tracking-wider text-navy">
                  {material.ratePerGram > 0
                    ? `NPR ${material.ratePerGram.toLocaleString("en-IN")}/g`
                    : "Rate on request"}
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-muted">{material.description}</p>
              {material.note && (
                <p className="mt-3 text-xs font-bold text-slate-500">{material.note}</p>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

const CUSTOM_SERVICES = [
  {
    title: "Design for print",
    text: "We prepare geometry, tolerances, supports and orientation so the first print is the right one.",
  },
  {
    title: "File repair",
    text: "Non-manifold meshes, missing walls and broken exports fixed before slicing.",
  },
  {
    title: "Material guidance",
    text: "PLA or PETG, wall count, infill and finish — chosen around how the part will be used.",
  },
  {
    title: "Scaling and fitting",
    text: "Resize a model while keeping clearances that still work in the real world.",
  },
  {
    title: "Small-batch runs",
    text: "Repeatable quantities for classroom sets, fixtures and product samples.",
  },
  {
    title: "Post-processing",
    text: "Support removal, clean-up and finish options discussed with the quote.",
  },
];

export function PrintCustomServices() {
  return (
    <section className="mx-auto max-w-7xl px-5 pt-10 lg:px-8" aria-labelledby="print-services">
      <p className="text-xs font-black uppercase tracking-[.24em] text-navy">
        Custom print services
      </p>
      <h2 id="print-services" className="mt-2 font-display text-2xl font-bold sm:text-3xl">
        More than pressing start.
      </h2>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {CUSTOM_SERVICES.map((service) => (
          <article key={service.title} className="rounded-2xl border border-line bg-white p-5">
            <h3 className="font-display text-base font-bold text-ink">{service.title}</h3>
            <p className="mt-1 text-sm leading-6 text-muted">{service.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function PrintGallery({ items }: { items: PrintGalleryItem[] }) {
  if (items.length === 0) return null;
  return (
    <section className="mx-auto max-w-7xl px-5 pt-10 lg:px-8" aria-labelledby="print-gallery">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[.24em] text-navy">Gallery</p>
          <h2 id="print-gallery" className="mt-2 font-display text-2xl font-bold sm:text-3xl">
            Prints from the workshop.
          </h2>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item) => (
          <figure
            key={item.id}
            className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm"
          >
            <div className="relative aspect-square w-full bg-mist">
              <Image
                src={item.image}
                alt={item.caption || "Printed part"}
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                className="object-cover"
              />
            </div>
            {(item.caption || item.category) && (
              <figcaption className="p-3">
                {item.caption && (
                  <span className="block text-sm font-bold leading-snug text-ink">
                    {item.caption}
                  </span>
                )}
                {item.category && (
                  <span className="mt-1 block text-[11px] font-black uppercase tracking-wider text-navy">
                    {item.category}
                  </span>
                )}
              </figcaption>
            )}
          </figure>
        ))}
      </div>
    </section>
  );
}
