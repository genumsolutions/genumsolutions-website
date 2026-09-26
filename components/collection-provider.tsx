"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

// U-47 (2026-09-27): client-side heart state for the user collection.
// Hydrates once from /api/collection; the toggle is optimistic — the heart
// flips instantly and reverts if the POST fails or the guest must sign in.

type CollectionContextValue = {
  savedIds: Set<string>;
  has: (id: string) => boolean;
  toggle: (id: string, kind?: "product" | "service") => Promise<void>;
};

const CollectionContext = createContext<CollectionContextValue>({
  savedIds: new Set(),
  has: () => false,
  toggle: async () => {},
});

export function CollectionProvider({ children }: { children: React.ReactNode }) {
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let active = true;
    fetch("/api/collection")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (active && d?.signedIn) {
          setSavedIds(new Set((d.items ?? []).map((i: { itemId: string }) => i.itemId)));
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const toggle = useCallback(
    async (id: string, kind: "product" | "service" = "product") => {
      const wasSaved = savedIds.has(id);
      setSavedIds((current) => {
        const next = new Set(current);
        if (wasSaved) next.delete(id);
        else next.add(id);
        return next;
      });
      try {
        const response = await fetch("/api/collection", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemId: id, kind }),
        });
        if (!response.ok) throw new Error("toggle failed");
      } catch {
        // Revert the optimistic flip on failure (guest 401 included).
        setSavedIds((current) => {
          const next = new Set(current);
          if (wasSaved) next.delete(id);
          else next.add(id);
          return next;
        });
      }
    },
    [savedIds]
  );

  const has = useCallback((id: string) => savedIds.has(id), [savedIds]);

  return (
    <CollectionContext.Provider value={{ savedIds, has, toggle }}>
      {children}
    </CollectionContext.Provider>
  );
}

export function useCollection() {
  return useContext(CollectionContext);
}
