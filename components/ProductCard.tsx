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
// changes), 2 spec chips, and â‰¥44px touch-friendly CTAs.
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
        <div className="flex flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-sm transition hover:shadow-md">
       <Link
        href={`/products/${product.id}`}
        aria-label={`View ${product.name}`}
        // U-24 (2026-09-24): whole-image card (owner: "like the app") â€” the
        // media box shows the FULL photo on a light tray like the native card;
        // no dark gradient, no caption text on the image.
        className={`relative block overflow-hidden bg-mist ${compact ? "aspect-[4/3]" : "aspect-square"}`}
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
          className="object-contain transition duration-500 hover:scale-105"
        />
      </Link>
      <div className="flex flex-1 flex-col p-2">
        <p className="truncate text-xs font-black uppercase tracking-widest text-navy">
          {typeLabel || product.badge || product.productType}
        </p>
        <h2
          className={`mt-1 font-display font-bold leading-snug ${
            compact ? "line-clamp-2 text-xs" : "line-clamp-2 text-xs"
          }`}
        >
          {product.name}
        </h2>
        {!compact &&
        product.importMeta?.creator &&
        (product.importMeta.creator as string).trim() ? (
          <p
            className="mt-0.5 truncate text-[10px] font-semibold text-muted"
            title={`Design: ${String(product.importMeta.creator)}${
              product.importMeta.license ? ` · ${String(product.importMeta.license)}` : ""
            }`}
          >
            Design: {String(product.importMeta.creator)}
          </p>
        ) : null}
        {!compact && chips.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {chips.map((chip) => (
              <span
                key={chip}
                className="inline-block max-w-full truncate rounded-full border border-line bg-mist px-1.5 py-0.5 text-[10px] font-bold text-muted"
                title={chip}
              >
                {chip}
              </span>
            ))}
          </div>
        )}
        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2.5">
          <strong className="font-display text-sm">{product.priceLabel}</strong>
          {showCta &&
            (quoteOnly ? (
              <Link
                href={`/products/${product.id}`}
                className="inline-flex min-h-9 items-center rounded-full bg-navy px-3 py-1.5 text-xs font-black text-white transition hover:bg-navy-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
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
                className={`inline-flex min-h-9 items-center rounded-full px-3 py-1.5 text-xs font-black text-white transition hover:bg-navy-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy ${
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
  );
}
