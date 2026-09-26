"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Heart } from "lucide-react";

// U-47 (2026-09-27): the signed-in user's collection — every card they
// hearted across products, projects, and services. Hydrated from
// /api/collection (rows are RLS-scoped to the caller); hearts here remove
// items live via the same provider the cards use.

type CollectionCard = {
  itemId: string;
  itemKind: "product" | "service";
  name: string;
  priceLabel: string;
  image: string;
  href: string;
  savedAt: string;
};

export default function MyCollection() {
  const [items, setItems] = useState<CollectionCard[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/collection")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!active) return;
        setSignedIn(Boolean(d?.signedIn));
        setItems(d?.items ?? []);
        setLoaded(true);
      })
      .catch(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  if (!loaded) return null;

  return (
    <section
      id="collection"
      className="rounded-2xl border border-line bg-white p-6 shadow-card sm:p-8"
    >
      <h2 className="font-display text-xl font-bold text-ink">My collection</h2>
      <p className="mt-1 text-sm text-muted">
        Everything you hearted — products, projects, and services — saved to your profile.
      </p>
      {!signedIn ? (
        <p className="mt-3 text-sm text-slate-500">Sign in to keep a collection.</p>
      ) : items.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">
          Nothing saved yet — tap the ♥ on any card to keep it here.
        </p>
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {items.map((item) => (
            <div
              key={`${item.itemKind}-${item.itemId}`}
              className="relative flex flex-col overflow-hidden rounded-2xl border border-line bg-white"
            >
              <Link
                href={item.href}
                aria-label={`Open ${item.name}`}
                className="relative block aspect-square w-full overflow-hidden bg-mist"
              >
                {item.image ? (
                  <Image
                    src={item.image}
                    alt={item.name}
                    fill
                    sizes="(max-width: 640px) 50vw, 20vw"
                    className="object-contain"
                  />
                ) : (
                  <span className="flex h-full items-center justify-center text-muted">
                    <Heart size={22} aria-hidden="true" />
                  </span>
                )}
              </Link>
              <Link
                href={item.href}
                className="block px-2 pb-2 pt-1.5"
                aria-label={`Open ${item.name}`}
              >
                <span className="block truncate text-[13px] font-bold leading-tight text-ink">
                  {item.name}
                </span>
                <span className="mt-0.5 block text-xs font-black text-navy">
                  {item.priceLabel || (item.itemKind === "service" ? "Service" : "")}
                </span>
              </Link>
              <button
                type="button"
                onClick={() => {
                  setItems((current) => current.filter((c) => c.itemId !== item.itemId));
                  fetch("/api/collection", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ itemId: item.itemId, kind: item.itemKind }),
                  }).catch(() => undefined);
                }}
                aria-label={`Remove ${item.name} from collection`}
                className="absolute right-2 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-red-500 shadow-sm transition hover:scale-110"
              >
                <Heart size={16} fill="currentColor" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
