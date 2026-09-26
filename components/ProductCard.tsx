"use client";

import Link from "next/link";
import Image from "next/image";
import { Heart } from "lucide-react";
import type { Product } from "../lib/catalog";
import { galleryImages } from "../lib/catalog";
import { getProductMedia } from "../lib/product-media";
import { useCollection } from "./collection-provider";

// U-47 (2026-09-27) owner redesign: the whole card IS the link — bare
// minimum (square photo, name, price), tight spacing, no badge/chips/CTA.
// Details live on the product page. Grid parents control columns: 2 per
// row on phones (owner: "just like the mobile app") up to 5 at xl.
// The heart toggles the user collection (stopPropagation keeps the tap
// from also navigating).
export default function ProductCard({ product }: { product: Product }) {
  const fallbackMedia = getProductMedia(product.category);
  const media = galleryImages(product)[0] ?? fallbackMedia.src;
  const { has, toggle } = useCollection();
  const saved = has(product.id);

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-sm transition hover:shadow-md">
      <Link
        href={`/products/${product.id}`}
        aria-label={`Open ${product.name}`}
        className="relative block aspect-square w-full overflow-hidden bg-mist"
      >
        <Image
          src={media}
          alt={product.name}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
          className="object-contain transition duration-500 group-hover:scale-105"
        />
      </Link>
      <Link
        href={`/products/${product.id}`}
        aria-label={`Open ${product.name}`}
        className="block px-2 pb-2 pt-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
      >
        <span className="block truncate text-[13px] font-bold leading-tight text-ink">
          {product.name}
        </span>
        <span className="mt-0.5 block text-xs font-black text-navy">{product.priceLabel}</span>
      </Link>
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void toggle(product.id);
        }}
        aria-pressed={saved}
        aria-label={
          saved ? `Remove ${product.name} from collection` : `Save ${product.name} to collection`
        }
        className={`absolute right-2 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow-sm transition hover:scale-110 ${
          saved ? "text-red-500" : "text-slate-400 hover:text-navy"
        }`}
      >
        <Heart size={16} fill={saved ? "currentColor" : "none"} aria-hidden="true" />
      </button>
    </div>
  );
}
