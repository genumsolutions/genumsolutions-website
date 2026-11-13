"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowUpRight, Check } from "lucide-react";
import { galleryImages, relatedProducts, scopeForProduct, type Product } from "../lib/catalog";
import { getProductMedia } from "../lib/product-media";
import { useCart } from "./cart-provider";
import { recordProductView } from "../lib/recently-viewed";
import ProductCard from "./ProductCard";
import {
  defaultProjectPricing,
  estimateProject,
  formatNPR,
  projectPricingAvailable,
  resolveLine,
  type ProjectPricing,
  type ProjectPricingEstimate,
  type ProjectPricingLine,
} from "../lib/project-pricing";

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
  const isProjectPackage = product.productType === "Project package";
  const isOutOfStock = !isProjectPackage && (product.stock ?? 0) <= 0;
  const canPurchase = !isProjectPackage && (product.stock ?? 0) > 0;
  const related = relatedProducts(allProducts, product);
  const images = galleryImages(product);
  // 2026-11-13: both <Image> sources pointed at /placeholder.jpg, which is not
  // in public/, so any product without its own photo rendered a broken image.
  // Use the same category fallback the catalog cards use (lib/product-media).
  const fallbackMedia = getProductMedia(product.category);
  const mainImage = images[activeImage] || fallbackMedia.src;
  // This route serves all three catalogs, so "Back to the shop" sent a 3D
  // model or a project package into the electronics catalog.
  const productScope = scopeForProduct(product);
  const backLink =
    productScope === "models"
      ? { href: "/3d-printing", label: "Back to 3D printing" }
      : productScope === "projects" || productScope === "cars"
        ? { href: "/projects", label: "Back to projects" }
        : { href: "/products", label: "Back to the shop" };
  // A blank "Difficulty" row (or any other unset field) read as a missing
  // value; drop rows without content instead of drawing an empty line.
  const infoRows: [string, string][] = (
    [
      ["SKU", product.sku || product.id],
      [
        "Availability",
        product.productType === "Project package"
          ? "Quote-based package"
          : product.stock > 0
            ? `In stock (${product.stock} unit${product.stock === 1 ? "" : "s"})`
            : "Out of stock — unavailable for direct purchase (ask about restock)",
      ],
      ["Delivery", product.delivery || "Nepal-wide courier"],
      ["Warranty", product.warranty || "7-day replacement"],
      ["Best for", product.audience || "Makers, schools, and engineers"],
      ["Difficulty", product.difficulty],
    ] as [string, string | undefined][]
  ).filter((row): row is [string, string] => Boolean(row[1]));
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

  // U-45: project↔component links for THIS product. For a project: the
  // catalog components it needs (with qty). For a component: the projects
  // that use it. Fetched client-side (staff-managed join table; empty → the
  // sections vanish, never render as a stub).
  const [componentRows, setComponentRows] = useState<{ productId: string; quantity: number }[]>([]);
  const [usedInRows, setUsedInRows] = useState<{ projectId: string }[]>([]);
  useEffect(() => {
    let active = true;
    if (product.productType === "Project package") {
      fetch(`/api/admin/project-components?projectId=${encodeURIComponent(product.id)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (active && d) setComponentRows(d.components ?? []);
        })
        .catch(() => undefined);
    } else {
      fetch(`/api/project-usage?productId=${encodeURIComponent(product.id)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (active && d) setUsedInRows(d.projects ?? []);
        })
        .catch(() => undefined);
    }
    return () => {
      active = false;
    };
  }, [product.id, product.productType]);
  const componentProducts = componentRows
    .map((row) => ({
      qty: row.quantity,
      product: allProducts.find((p) => p.id === row.productId && p.active !== false),
    }))
    .filter((entry): entry is { qty: number; product: Product } => Boolean(entry.product));

  // 2026-11-13: project pricing — published price + calculator on the detail page.
  // Fetched client-side (the project_pricing row is staff-managed; empty/draft →
  // the price stays "rate on request" and the calculator stays hidden).
  const [projectPricing, setProjectPricing] = useState<ProjectPricing>(defaultProjectPricing);
  useEffect(() => {
    if (product.productType !== "Project package") {
      setProjectPricing(defaultProjectPricing);
      return;
    }
    let active = true;
    fetch(`/api/project-pricing/${encodeURIComponent(product.id)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (active && d?.pricing) setProjectPricing(d.pricing as ProjectPricing);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [product.id, product.productType]);

  // 2026-11-13: the calculator lets a buyer change each component's quantity;
  // the estimate then recalculates with the same rules the admin panel uses.
  const [quantityOverrides, setQuantityOverrides] = useState<Record<string, number>>({});
  useEffect(() => setQuantityOverrides({}), [product.id]);

  const projectLines = useMemo<ProjectPricingLine[]>(() => {
    if (!isProjectPackage) return [];
    return componentRows
      .map((row) => {
        const found = allProducts.find((p) => p.id === row.productId && p.active !== false);
        if (!found) return null;
        const quantity = Math.max(1, quantityOverrides[row.productId] ?? row.quantity);
        const line = resolveLine(
          { productId: row.productId, quantity },
          found.price,
          projectPricing.componentMarkupPercent
        );
        return { ...line, name: found.name };
      })
      .filter((line): line is ProjectPricingLine => Boolean(line));
  }, [
    isProjectPackage,
    componentRows,
    allProducts,
    quantityOverrides,
    projectPricing.componentMarkupPercent,
  ]);

  const projectEstimate = useMemo<ProjectPricingEstimate>(() => {
    if (!isProjectPackage) {
      return {
        available: false,
        packageBaseCharge: 0,
        componentsTotal: 0,
        extrasTotal: 0,
        subtotal: 0,
        discountPercent: 0,
        discountAmount: 0,
        beforeMinimum: 0,
        total: 0,
        minimumApplied: false,
        minimumOrder: 0,
        reason: "",
      };
    }
    return estimateProject({
      pricing: projectPricing,
      links: projectLines.map((line) => ({
        productId: line.productId,
        quantity: line.quantity,
      })),
      catalogPrices: new Map(projectLines.map((line) => [line.productId, line.catalogPrice])),
    });
  }, [isProjectPackage, projectLines, projectPricing]);

  // Only publish a price when the row is approved AND it resolves to a real
  // amount — an approved row with no base charge, markup or priced components
  // must not render "NPR 0".
  const pricingPublished =
    isProjectPackage &&
    projectEstimate.available &&
    projectPricingAvailable(projectPricing) &&
    projectEstimate.total > 0;

  const usedInProjects = usedInRows
    .map((row) => allProducts.find((p) => p.id === row.projectId && p.active !== false))
    .filter((p): p is Product => Boolean(p));

  // C3: record this view (localStorage, best-effort) once per mount.
  // U-47v2: also fire the per-user habit counter (server-side, fire-and-forget;
  // guests are ignored by the RPC).
  useEffect(() => {
    recordProductView(product.id);
    fetch("/api/habits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "view" }),
      keepalive: true,
    }).catch(() => undefined);
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
    if (!canPurchase) return;
    add(product.id, Math.min(Math.max(1, quantity), product.stock));
    fetch("/api/habits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "cart" }),
      keepalive: true,
    }).catch(() => undefined);
    setAdded(true);
  }

  return (
    <div className="min-h-screen bg-mist">
      <div className="mx-auto max-w-7xl px-5 py-6 sm:py-8 lg:px-8">
        <Link
          href={backLink.href}
          className="inline-flex items-center gap-1.5 text-sm font-bold text-navy transition hover:text-navy-dark"
        >
          <ArrowLeft size={15} aria-hidden="true" /> {backLink.label}
        </Link>
        <div className="mt-6 grid gap-8 sm:mt-8 sm:gap-10 lg:grid-cols-[.9fr_1.1fr] lg:items-start">
          <div>
            <div className="relative z-0 aspect-square overflow-hidden rounded-2xl bg-white ring-1 ring-line sm:rounded-3xl">
              <Image
                src={mainImage}
                alt={
                  images.length > 0 ? `${product.name} photo ${activeImage + 1}` : fallbackMedia.alt
                }
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
                      src={src || fallbackMedia.src}
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
              <span className="font-display text-3xl font-bold">
                {pricingPublished ? formatNPR(projectEstimate.total) : product.priceLabel}
              </span>
              <span className="text-sm text-muted">
                {isProjectPackage
                  ? pricingPublished
                    ? `indicative package estimate · ${projectLines.length} ${
                        projectLines.length === 1 ? "component" : "components"
                      }`
                    : "rate on request"
                  : "per unit"}
              </span>
            </div>
            {pricingPublished ? (
              <div className="mt-6">
                <div className="rounded-xl border border-line bg-card p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className={"text-sm font-bold text-ink"}>
                      Quote calculator{" "}
                      <span className="text-muted">({projectLines.length} components)</span>
                    </h2>
                    <span className="text-sm font-display font-bold text-navy">
                      {formatNPR(projectEstimate.total)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    Adjust the quantities below to see how the indicative price changes. Final
                    contracts are confirmed with the team after you request a quote.
                  </p>
                  {/* component breakdown */}
                  {projectLines.length > 0 ? (
                    <div className="mt-4 space-y-3">
                      {projectLines.map((line) => (
                        <div
                          key={line.productId}
                          className="rounded-lg border border-line bg-white p-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-bold text-ink">{line.name}</p>
                              <p className="text-xs text-muted">
                                {projectPricing.componentMarkupPercent > 0
                                  ? `${formatNPR(line.catalogPrice)} catalog + ${projectPricing.componentMarkupPercent}% markup = ${formatNPR(line.unitPrice)}/unit`
                                  : `${formatNPR(line.catalogPrice)}/unit from the catalog`}
                              </p>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="flex items-center rounded-full border border-line">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setQuantityOverrides((prev) => ({
                                      ...prev,
                                      [line.productId]: Math.max(1, line.quantity - 1),
                                    }))
                                  }
                                  className="h-8 w-8 rounded-l-full text-sm font-bold transition hover:bg-mist"
                                  aria-label={`Decrease ${line.name} quantity`}
                                >
                                  −
                                </button>
                                <span
                                  className="w-8 text-center text-xs font-bold"
                                  aria-live="polite"
                                >
                                  {line.quantity}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setQuantityOverrides((prev) => ({
                                      ...prev,
                                      [line.productId]: Math.min(99, line.quantity + 1),
                                    }))
                                  }
                                  className="h-8 w-8 rounded-r-full text-sm font-bold transition hover:bg-mist"
                                  aria-label={`Increase ${line.name} quantity`}
                                >
                                  +
                                </button>
                              </div>
                              <span className="w-28 text-right text-sm font-bold text-ink">
                                {formatNPR(line.lineTotal)}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-muted">
                      No catalog components are linked to this package yet.
                    </p>
                  )}
                  {/* extras */}
                  {projectEstimate.extrasTotal > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2 text-sm">
                      {projectPricing.extras.map((extra) => {
                        if (extra.amount <= 0) return null;
                        return (
                          <span
                            key={extra.id}
                            className="rounded-lg border border-line bg-white px-3 py-2"
                          >
                            {extra.name} <span className="text-muted">·</span>{" "}
                            {formatNPR(extra.amount)}
                          </span>
                        );
                      })}
                    </div>
                  )}
                  {/* summary */}
                  <dl className="mt-4 divide-y divide-line border-t border-line text-sm">
                    <div className="flex justify-between py-2">
                      <span className="text-muted">Package base charge</span>
                      <span className="font-bold text-ink">
                        {formatNPR(projectEstimate.packageBaseCharge)}
                      </span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-muted">Components</span>
                      <span className="font-bold text-ink">
                        {formatNPR(projectEstimate.componentsTotal)}
                      </span>
                    </div>
                    {projectEstimate.extrasTotal > 0 && (
                      <div className="flex justify-between py-2">
                        <span className="text-muted">Extras</span>
                        <span className="font-bold text-ink">
                          {formatNPR(projectEstimate.extrasTotal)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between py-2">
                      <span className="text-muted">Subtotal</span>
                      <span className="font-bold text-ink">
                        {formatNPR(projectEstimate.subtotal)}
                      </span>
                    </div>
                    {projectEstimate.discountPercent > 0 && (
                      <div className="flex justify-between py-2">
                        <span className="text-muted">
                          Bulk discount ({projectEstimate.discountPercent}%)
                        </span>
                        <span className="font-bold text-red-600">
                          −{formatNPR(projectEstimate.discountAmount)}
                        </span>
                      </div>
                    )}
                    {projectEstimate.minimumApplied && (
                      <div className="flex justify-between py-2">
                        <span className="text-muted">
                          Minimum order {formatNPR(projectEstimate.minimumOrder)} applied
                        </span>
                        <span className="font-bold text-ink">
                          {formatNPR(projectEstimate.beforeMinimum)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between py-3">
                      <span className="font-bold text-ink">Indicative price</span>
                      <span className="font-display text-lg font-bold text-navy">
                        {formatNPR(projectEstimate.total)}
                      </span>
                    </div>
                  </dl>
                  <p className="mt-3 text-xs text-muted">
                    Indicative only — the final package price is confirmed by the team after you
                    request a quote.
                  </p>
                </div>
              </div>
            ) : isProjectPackage && projectPricing.priceStatus === "approved" ? (
              <p className="mt-6 rounded-xl border border-dashed border-line bg-mist/60 px-5 py-4 text-sm text-muted">
                Pricing approved but no components, extras, base charge or markup set yet — set
                those in the admin project editor to show the calculator.
              </p>
            ) : null}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              {canPurchase && (
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
              {pricingPublished ? (
                <>
                  <Link
                    href="/contact"
                    className="rounded-full bg-navy px-6 py-3.5 text-sm font-black text-white transition hover:bg-navy-dark"
                    aria-label={`Request a quote for ${product.name} with the quantities above`}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      Request this package
                      <ArrowUpRight size={15} aria-hidden="true" />
                    </span>
                  </Link>
                  <p className="text-xs text-muted">
                    The estimate recalculates live as you change component quantities above.
                  </p>
                </>
              ) : isProjectPackage ? (
                <Link
                  href="/contact"
                  className="rounded-full bg-navy px-6 py-3.5 text-sm font-black text-white transition hover:bg-navy-dark"
                  aria-label={`Request a quote for ${product.name}`}
                >
                  <span className="inline-flex items-center gap-1.5">
                    Request a scoped quote
                    <ArrowUpRight size={15} aria-hidden="true" />
                  </span>
                </Link>
              ) : isOutOfStock ? (
                <Link
                  href="/contact"
                  className="rounded-full bg-ink px-6 py-3.5 text-sm font-black text-white transition hover:bg-navy-dark"
                  aria-label={`${product.name} is out of stock — ask about availability`}
                >
                  <span className="inline-flex items-center gap-1.5">
                    Out of stock — ask about availability
                    <ArrowUpRight size={15} aria-hidden="true" />
                  </span>
                </Link>
              ) : (
                <Link
                  href="/checkout"
                  onClick={addToBuildList}
                  className={`rounded-full px-6 py-3.5 text-sm font-black text-white transition ${added ? "bg-emerald-600" : "bg-navy hover:bg-navy-dark"}`}
                  aria-label={
                    added
                      ? `${product.name} added to build list`
                      : `Add ${product.name} to build list`
                  }
                >
                  <span className="inline-flex items-center gap-1.5">
                    {added ? "Added to build list" : "Add to build list"}
                    {added ? <Check size={15} aria-hidden="true" /> : null}
                  </span>
                </Link>
              )}
            </div>
            {isOutOfStock && (
              <p className="mt-3 text-sm text-muted">
                This item is currently unavailable for direct purchase. Contact us to ask about
                restock timing or a backorder.
              </p>
            )}
          </div>
        </div>

        {/* U-45b (2026-09-26): ecommerce-standard info grid — SKU, live
            stock state, delivery, warranty, audience, difficulty in one
            scannable table (the two loose two-up grids they replace). */}
        <div className="mt-10 border-y border-line py-6">
          <p className="text-xs font-black uppercase tracking-widest text-navy">
            Product information
          </p>
          <dl className="mt-3 grid gap-x-8 gap-y-2 sm:grid-cols-2">
            {infoRows.map(([label, value]) => (
              <div
                key={label}
                className="flex items-baseline justify-between gap-4 border-b border-line py-1.5"
              >
                <dt className="text-xs font-black uppercase tracking-widest text-slate-500">
                  {label}
                </dt>
                <dd className="text-right text-sm text-ink">{value}</dd>
              </div>
            ))}
          </dl>
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

        {/* U-45: project detail shows the catalog components its build needs;
            component detail shows the projects that use it. Both hidden when
            the join table has no rows for this product. */}
        {product.productType === "Project package" && componentProducts.length > 0 && (
          <div className="mt-12 border-t-2 border-line pt-8">
            <p className="text-xs font-black uppercase tracking-[.24em] text-navy">
              Components used in this project
            </p>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              Every part below is a real catalog component — check specs, availability, and add
              spares to your build list.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {componentProducts.map(({ product: item, qty }) => (
                <div key={item.id} className="relative">
                  <span
                    className="absolute -right-1.5 -top-1.5 z-10 flex h-6 min-w-6 items-center justify-center rounded-full bg-gold px-1.5 text-[11px] font-black text-ink shadow"
                    aria-label={`Quantity ${qty}`}
                  >
                    ×{qty}
                  </span>
                  <ProductCard product={item} />
                </div>
              ))}
            </div>
          </div>
        )}
        {product.productType !== "Project package" && usedInProjects.length > 0 && (
          <div className="mt-12 border-t-2 border-line pt-8">
            <p className="text-xs font-black uppercase tracking-[.24em] text-navy">
              Used in these projects
            </p>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {usedInProjects.map((item) => (
                <ProductCard key={item.id} product={item} />
              ))}
            </div>
          </div>
        )}

        {related.length > 0 && (
          <div className="mt-12 border-t-2 border-line pt-8">
            <p className="text-xs font-black uppercase tracking-[.24em] text-navy">
              Related products
            </p>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {related.map((item) => (
                <ProductCard key={item.id} product={item} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
