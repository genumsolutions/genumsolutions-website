"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Product } from "../lib/catalog";
import { getProductMedia } from "../lib/product-media";

type Slide =
  | { kind: "statement"; eyebrow: string; title: string; body: string; href: string; cta: string }
  | { kind: "product"; product: Product };

/**
 * U-46 (2026-09-26) — home hero carousel. Slides mix a brand statement with
 * REAL featured items from the shared products table (passed down from the
 * server component, so slide 1 renders identically on server and client —
 * no hydration risk; later slides are pure client-side state).
 * Auto-advances every 6s; pauses after manual navigation.
 */
export default function HeroCarousel({ products = [] }: { products?: Product[] }) {
  const statement: Slide = {
    kind: "statement",
    eyebrow: "Build what matters",
    title: "From first circuit to real-world launch.",
    body: "Robotics kits, printing, and training — designed in Kathmandu.",
    href: "/products",
    cta: "Browse the catalog",
  };
  const statementMedia = getProductMedia("Robotics");
  const slides: Slide[] = [
    statement,
    ...products.slice(0, 4).map((product): Slide => ({ kind: "product", product })),
  ];
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || slides.length <= 1) return;
    const timer = window.setInterval(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [paused, slides.length]);

  const go = (next: number) => {
    setIndex(((next % slides.length) + slides.length) % slides.length);
    setPaused(true);
  };

  return (
    <div
      className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-ink shadow-2xl sm:aspect-square lg:aspect-[4/3]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carousel"
      aria-label="Featured highlights"
    >
      {slides.map((slide, i) => {
        const active = i === index;
        return (
          <div
            key={slide.kind === "product" ? slide.product.id : "statement"}
            className={`absolute inset-0 transition-opacity duration-700 ${active ? "opacity-100" : "pointer-events-none opacity-0"}`}
            aria-hidden={!active}
          >
            {slide.kind === "product" ? (
              <>
                <Link
                  href={`/products/${slide.product.id}`}
                  className="relative block h-full w-full"
                  tabIndex={active ? 0 : -1}
                >
                  {slide.product.image ? (
                    <Image
                      src={slide.product.image}
                      alt={slide.product.name}
                      fill
                      priority={i === 0}
                      sizes="(max-width: 1024px) 100vw, 45vw"
                      className="object-cover opacity-90"
                    />
                  ) : (
                    <span className="flex h-full items-center justify-center text-sm font-black uppercase tracking-widest text-white/60">
                      {slide.product.name}
                    </span>
                  )}
                </Link>
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/90 to-transparent p-5 text-white sm:p-6">
                  <p className="text-xs font-black uppercase tracking-[.2em] text-gold">
                    Featured · {slide.product.category}
                  </p>
                  <p className="mt-2 max-w-xs font-display text-xl font-bold leading-snug sm:text-2xl">
                    {slide.product.name}
                  </p>
                  <p className="mt-1 text-sm font-bold text-white/80">{slide.product.priceLabel}</p>
                </div>
              </>
            ) : (
              <>
                <Image
                  src={statementMedia.src}
                  alt={statementMedia.alt}
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 45vw"
                  className="object-cover opacity-90"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/90 to-transparent p-5 text-white sm:p-6">
                  <p className="text-xs font-black uppercase tracking-[.2em] text-gold">
                    {slide.eyebrow}
                  </p>
                  <p className="mt-2 max-w-xs font-display text-xl font-bold leading-snug sm:text-2xl">
                    {slide.title}
                  </p>
                </div>
              </>
            )}
          </div>
        );
      })}

      {slides.length > 1 && (
        <>
          <div className="absolute inset-y-0 left-0 flex items-center pl-2">
            <button
              type="button"
              onClick={() => go(index - 1)}
              aria-label="Previous slide"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/85 text-ink shadow transition hover:bg-white"
            >
              <ChevronLeft size={18} aria-hidden="true" />
            </button>
          </div>
          <div className="absolute inset-y-0 right-0 flex items-center pr-2">
            <button
              type="button"
              onClick={() => go(index + 1)}
              aria-label="Next slide"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/85 text-ink shadow transition hover:bg-white"
            >
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </div>
          <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
            {slides.map((slide, i) => (
              <button
                key={slide.kind === "product" ? `dot-${slide.product.id}` : "dot-statement"}
                type="button"
                onClick={() => go(i)}
                aria-label={`Go to slide ${i + 1}`}
                aria-current={i === index}
                className={`h-2 rounded-full transition-all ${i === index ? "w-5 bg-gold" : "w-2 bg-white/60 hover:bg-white"}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
