"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowUpRight, Check } from "lucide-react";
import { galleryImages, relatedProducts, type Product } from "../lib/catalog";
import { useCart } from "./cart-provider";
import { recordProductView } from "../lib/recently-viewed";
import ProductCard from "./ProductCard";

// C3 (2026-09-23): "Related products" row on the detail page. The full list
// is passed down from the server page; the row renders client-side after
// mount so SSR output stays deterministic.
export default function ProductDetailPro({
  product,
  allProducts = [],
}: {
  product: Product;
  allProducts?: Product[];
}) {
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [activeImage, setActiveImage] = useState(0);
  const { add } = useCart();
  const isQuote = product.productType === "Project package" || product.stock === 0;
  const related = relatedProducts(allProducts, product);
  const images = galleryImages(product);
  // U-24 (2026-09-24): canonical MakerWorld specs as rows; falls back to the
  // plain `specs` chip lines when a product was entered by hand.
  const specRows = product.importMeta?.structuredSpecs?.length
    ? product.importMeta.structuredSpecs
    : product.specs
        .filter(Boolean)
        .map((line) => {
          const idx = line.indexOf(":");
          return idx > 0
            ? { key: line.slice(0, idx).trim(), value: line.slice(idx + 1).trim() }
            : { key: "", value: line };
        })
        .filter((row) => row.key);

  // U-23 (2026-09-24): reset the gallery position if the product changes.
  useEffect(() => setActiveImage(0), [product.id]);

  // C3: record this view (localStorage, best-effort) once per mount.
  useEffect(() => {
    recordProductView(product.id);
  }, [product.id]);
  const projectSections = [
    ["Objectives", product.objectives],
    ["Materials required", product.materialsRequired],
    ["Learning outcomes", product.learningOutcomes],
    ["Build steps", product.buildSteps],
    ["Control methods", product.controlMethods],
    ["Prerequisites", product.prerequisites],
    ["Deliverables", product.deliverables],
  ] as const;

  useEffect(() => {
    if (!added) return;
    const timer = window.setTimeout(() => setAdded(false), 2000);
    return () => window.clearTimeout(timer);
  }, [added]);

  function addToBuildList() {
    if (isQuote) return;
    add(product.id, Math.min(quantity, product.stock));
    setAdded(true);
  }

  return (
    <div className="min-h-screen bg-mist">
      <div className="mx-auto max-w-7xl px-5 py-6 sm:py-8 lg:px-8">
        <Link
          href="/products"
          className="inline-flex items-center gap-1.5 text-sm font-bold text-navy transition hover:text-navy-dark"
        >
          <ArrowLeft size={15} aria-hidden="true" /> Back to the shop
        </Link>
        <div className="mt-6 grid gap-8 sm:mt-8 sm:gap-10 lg:grid-cols-[.9fr_1.1fr] lg:items-start">
          <div>
            <div className="relative z-0 aspect-square overflow-hidden rounded-2xl bg-white ring-1 ring-line sm:rounded-3xl">
              <Image
                src={images[activeImage] || "/placeholder.jpg"}
                alt={`${product.name} photo ${activeImage + 1}`}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 40vw"
                className="object-contain"
              />
            </div>
            {images.length > 1 && (
              <div className="mt-3 flex flex-wrap gap-2" role="tablist" aria-label="Product photos">
                {images.map((src, i) => (
                  <button
                    key={src}
                    role="tab"
                    aria-selected={i === activeImage}
                    aria-label={`Show photo ${i + 1} of ${product.name}`}
                    onClick={() => setActiveImage(i)}
                    className={`relative h-16 w-16 overflow-hidden rounded-xl ring-2 transition sm:h-20 sm:w-20 ${
                      i === activeImage ? "ring-navy" : "ring-transparent hover:ring-line"
                    }`}
                  >
                    <Image
                      src={src || "/placeholder.jpg"}
                      alt=""
                      fill
                      sizes="80px"
                      className="object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[.24em] text-navy">
              {product.category} · {product.badge || product.productType}
            </p>
            <h1 className="mt-3 font-display text-2xl font-bold leading-none tracking-[-.03em] text-ink sm:text-3xl sm:leading-tight lg:text-5xl">
              {product.name}
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-muted sm:mt-5 sm:text-lg">
              {product.description}
            </p>
            {product.importMeta?.creator ||
            product.importMeta?.license ||
            product.importMeta?.sourceSite ||
            product.documentationUrl ? (
              <dl className="mt-3 max-w-xl divide-y divide-line rounded-xl border border-line bg-mist/60 px-4 py-2">
                {product.importMeta?.creator ? (
                  <div className="flex justify-between gap-4 py-2">
                    <dt className="text-xs font-black uppercase tracking-widest text-navy">
                      Design by
                    </dt>
                    <dd className="text-sm text-ink">{String(product.importMeta.creator)}</dd>
                  </div>
                ) : null}
                {product.importMeta?.license ? (
                  <div className="flex justify-between gap-4 py-2">
                    <dt className="text-xs font-black uppercase tracking-widest text-navy">
                      License
                    </dt>
                    <dd className="text-sm text-ink">{String(product.importMeta.license)}</dd>
                  </div>
                ) : null}
                {product.importMeta?.sourceSite || product.documentationUrl ? (
                  <div className="flex justify-between gap-4 py-2">
                    <dt className="text-xs font-black uppercase tracking-widest text-navy">
                      Source
                    </dt>
                    <dd className="text-sm">
                      {product.documentationUrl ? (
                        <a
                          href={product.documentationUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="font-bold text-navy underline decoration-line underline-offset-2 transition hover:text-navy-dark"
                        >
                          {product.importMeta?.sourceSite || "Original"} ↗
                        </a>
                      ) : (
                        <span className="text-ink">{product.importMeta?.sourceSite}</span>
                      )}
                    </dd>
                  </div>
                ) : null}
              </dl>
            ) : null}
            <div className="mt-7 flex flex-wrap items-baseline gap-3">
              <span className="font-display text-3xl font-bold">{product.priceLabel}</span>
              <span className="text-sm text-muted">
                {product.productType === "Project package" ? "indicative package" : "per unit"}
              </span>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              {!isQuote && (
                <div className="flex items-center rounded-full border border-line bg-white shadow-sm">
                  <button
                    onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                    className="h-11 w-11 rounded-l-full text-lg font-bold transition hover:bg-mist"
                    aria-label={`Decrease quantity of ${product.name}`}
                  >
                    −
                  </button>
                  <span
                    className="w-8 text-center text-sm font-bold"
                    aria-live="polite"
                    aria-label={`Quantity: ${quantity}`}
                  >
                    {quantity}
                  </span>
                  <button
                    onClick={() => setQuantity((value) => Math.min(product.stock, value + 1))}
                    className="h-11 w-11 rounded-r-full text-lg font-bold transition hover:bg-mist"
                    aria-label={`Increase quantity of ${product.name}`}
                  >
                    +
                  </button>
                </div>
              )}
              <Link
                href={isQuote ? "/contact" : "/checkout"}
                onClick={isQuote ? undefined : addToBuildList}
                className={`rounded-full px-6 py-3.5 text-sm font-black text-white transition ${added ? "bg-emerald-600" : "bg-navy hover:bg-navy-dark"}`}
                aria-label={
                  isQuote
                    ? `Request a quote for ${product.name}`
                    : added
                      ? `${product.name} added to build list`
                      : `Add ${product.name} to build list`
                }
              >
                <span className="inline-flex items-center gap-1.5">
                  {isQuote
                    ? "Request a scoped quote"
                    : added
                      ? "Added to build list"
                      : "Add to build list"}
                  {isQuote ? (
                    <ArrowUpRight size={15} aria-hidden="true" />
                  ) : added ? (
                    <Check size={15} aria-hidden="true" />
                  ) : null}
                </span>
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-10 grid gap-4 border-y border-line py-6 sm:grid-cols-2">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-navy">Audience</p>
            <p className="mt-2 text-sm leading-6 text-muted">{product.audience}</p>
            <p className="mt-2 text-sm leading-6 text-muted">{product.difficulty}</p>
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-navy">Warranty</p>
            <p className="mt-2 text-sm leading-6 text-muted">{product.warranty}</p>
          </div>
        </div>

        <div className="mt-10 grid gap-4 border-t-2 border-line py-6 sm:grid-cols-2">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-navy">Color</p>
            <p className="mt-2 text-sm leading-6 text-muted">
              {product.color
                ? product.color.replace(/from-\[.*?\]\s*to-\[.*?\]/, "Standard finish")
                : "Standard finish"}
            </p>
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-navy">Delivery</p>
            <p className="mt-2 text-sm leading-6 text-muted">{product.delivery}</p>
          </div>
        </div>
        {product.productType === "Project package" && (
          <div className="mt-10 border-t-2 border-line py-6">
            <p className="text-xs font-black uppercase tracking-widest text-navy">
              Project information
            </p>
            {product.projectOverview ? (
              <p className="mt-3 max-w-3xl text-sm leading-7 text-muted">
                {product.projectOverview}
              </p>
            ) : null}
            {product.estimatedDuration ? (
              <p className="mt-3 text-sm font-bold text-ink">
                Estimated duration:{" "}
                <span className="font-normal text-muted">{product.estimatedDuration}</span>
              </p>
            ) : null}
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {projectSections
                .filter(([, items]) => items?.length)
                .map(([title, items]) => (
                  <div key={title}>
                    <h2 className="text-sm font-bold text-ink">{title}</h2>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-muted">
                      {items?.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ))}
            </div>
            {product.maintenanceNotes ? (
              <p className="mt-6 text-sm leading-6 text-muted">
                <strong className="text-ink">Maintenance and safety:</strong>{" "}
                {product.maintenanceNotes}
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-4 text-sm font-bold text-navy">
              {product.documentationUrl ? (
                <a href={product.documentationUrl} target="_blank" rel="noreferrer">
                  Documentation ↗
                </a>
              ) : null}
              {product.videoUrl ? (
                <a href={product.videoUrl} target="_blank" rel="noreferrer">
                  Project video ↗
                </a>
              ) : null}
            </div>
          </div>
        )}

        {specRows.length > 0 && (
          <div className="mt-12 border-t-2 border-line pt-8">
            <p className="text-xs font-black uppercase tracking-[.24em] text-navy">
              Specifications
            </p>
            <dl className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2">
              {specRows.map((row) => (
                <div
                  key={row.key}
                  className="flex items-baseline justify-between gap-4 border-b border-line pb-2"
                >
                  <dt className="text-sm font-bold text-ink">{row.key}</dt>
                  <dd className="text-sm text-right text-muted">{row.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        {related.length > 0 && (
          <div className="mt-12 border-t-2 border-line pt-8">
            <p className="text-xs font-black uppercase tracking-[.24em] text-navy">
              Related products
            </p>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {related.map((item) => (
                <ProductCard key={item.id} product={item} compact showCta={false} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
