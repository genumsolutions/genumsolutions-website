"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import type { Product } from "../lib/catalog";
import { galleryImages } from "../lib/catalog";
import { getProductMedia } from "../lib/product-media";
import { useCart } from "./cart-provider";

// U-23 (2026-09-24): single shared product card used across the catalog,
// projects, related-products rows and recently-viewed. Image-led with a
// taller media box, gallery-aware cover (first gallery entry when the lead
// changes), 2 spec chips, and ≥44px touch-friendly CTAs.
export default function ProductCard({
  product,
  compact = false,
  showCta = true,
  typeLabel,
  addAriaLabel,
}: {
  product: Product;
  compact?: boolean;
  showCta?: boolean;
  typeLabel?: string;
  addAriaLabel?: string;
}) {
  const { add } = useCart();
  const [added, setAdded] = useState(false);
  const quoteOnly = product.stock === 0 || product.productType === "Project package";
  const fallbackMedia = getProductMedia(product.category);
  const media = galleryImages(product)[0] ?? fallbackMedia.src;
  const chips = (product.specs ?? []).slice(0, 2);

  useEffect(() => {
    if (!added) return;
    const timer = window.setTimeout(() => setAdded(false), 2000);
    return () => window.clearTimeout(timer);
  }, [added]);

  return (
    <article
      className={`flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-sm transition hover:shadow-md ${
        compact ? "" : ""
      }`}
    >
      <Link
        href={`/products/${product.id}`}
        aria-label={`View ${product.name}`}
        className={`relative block overflow-hidden bg-mist ${compact ? "h-28" : "h-56"}`}
      >
        <Image
          src={media}
          alt={product.name}
          fill
          sizes={
            compact
              ? "(max-width: 640px) 50vw, 25vw"
              : "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          }
          className="object-cover transition duration-500 hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/70 to-transparent" />
        <span className="absolute bottom-3 left-4 max-w-[calc(100%-2rem)] truncate text-xs font-black uppercase tracking-widest text-white">
          {product.category}
        </span>
      </Link>
      <div className={`flex flex-1 flex-col ${compact ? "p-3" : "p-5"}`}>
        <p className="truncate text-xs font-black uppercase tracking-widest text-navy">
          {typeLabel || product.badge || product.productType}
        </p>
        <h2
          className={`mt-2 font-display font-bold leading-snug ${
            compact ? "line-clamp-2 text-base" : "line-clamp-2 text-xl"
          }`}
        >
          {product.name}
        </h2>
        {!compact && (
          <>
            <p className="mt-2 line-clamp-2 flex-1 text-sm leading-6 text-muted">
              {product.note || product.description?.split(". ")[0]}
            </p>
            {chips.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {chips.map((chip) => (
                  <span
                    key={chip}
                    className="inline-block max-w-full truncate rounded-full border border-line bg-mist px-2.5 py-1 text-[11px] font-bold text-muted"
                    title={chip}
                  >
                    {chip}
                  </span>
                ))}
              </div>
            )}
          </>
        )}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <strong className="font-display text-lg">{product.priceLabel}</strong>
          {showCta &&
            (quoteOnly ? (
              <Link
                href={`/products/${product.id}`}
                className="rounded-full bg-navy px-4 py-2 text-xs font-black text-white transition hover:bg-navy-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
                aria-label={`View details for ${product.name}`}
              >
                View details
              </Link>
            ) : (
              <button
                onClick={() => {
                  add(product.id, 1);
                  setAdded(true);
                }}
                className={`rounded-full px-4 py-2 text-xs font-black text-white transition hover:bg-navy-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy ${
                  added ? "bg-emerald-600" : "bg-navy"
                }`}
                aria-label={addAriaLabel ?? `Add ${product.name} to build list`}
                aria-live="polite"
              >
                <span className="inline-flex items-center gap-1.5">
                  <Check size={13} aria-hidden="true" /> {added ? "Added" : "Add"}
                </span>
              </button>
            ))}
        </div>
      </div>
    </article>
  );
}
