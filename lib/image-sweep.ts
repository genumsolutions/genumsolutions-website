// =====================================================================
// lib/image-sweep.ts — the decision logic for removing unreferenced
// `product-images` objects, kept pure so it can be tested without Storage or
// a database.
//
// The dangerous part of any garbage collection is a false "unused": deleting
// a file the catalog still points at breaks a product page. So the plan errs
// towards keeping, on four independent grounds:
//   1. an exact `product-images/<path>` URL appears somewhere in the catalog,
//   2. the bare file name appears anywhere in the catalog (a row that stores
//      just `arduino-mega.webp` still counts),
//   3. the object is younger than the grace window — an import may be halfway
//      through writing its row,
//   4. the object is on the protected list (the placeholder every product
//      falls back to).
// scripts/sweep-images.ts owns the I/O; this module owns the judgement.
// =====================================================================

export type SweepObject = {
  name: string;
  size: number;
  /** Storage's `lastModified`, when the listing provides it. */
  lastModified?: string | null;
};

export type KeptReason = "protected" | "referenced" | "referenced-by-name" | "recent";

export type SweepPlan = {
  /** Safe to delete: nothing in the catalog mentions it and it is old enough. */
  unused: SweepObject[];
  kept: { object: SweepObject; reason: KeptReason }[];
  reclaimableBytes: number;
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Normalize a Storage path: strip leading slashes, decode percent escapes. */
export function normalizeObjectPath(path: string): string {
  const trimmed = path.trim().replace(/^\/+/, "");
  try {
    return decodeURIComponent(trimmed);
  } catch {
    return trimmed;
  }
}

/**
 * Every object path a catalogue row mentions for `bucket`, in either absolute
 * (`https://…/storage/v1/object/public/<bucket>/x.webp`) or relative
 * (`/product-images/x.webp`) form. Query strings and fragments are dropped.
 */
export function extractObjectPaths(text: string, bucket: string): string[] {
  if (!text.includes(bucket)) return [];
  const pattern = new RegExp(`${escapeRegExp(bucket)}/([^\\s"'\`\\\\?#,)}<>]+)`, "g");
  const found = new Set<string>();
  for (const match of text.matchAll(pattern)) {
    const raw = match[1];
    if (!raw) continue;
    const path = normalizeObjectPath(raw);
    if (path) found.add(path);
  }
  return [...found];
}

/**
 * Decide what may be removed. Pure: pass the objects, the paths the catalog
 * references, and the raw catalog text used for the bare-name check.
 */
export function planSweep(input: {
  objects: readonly SweepObject[];
  referencedPaths: Iterable<string>;
  /** Catalog rows as text; only used for the bare file-name guard. */
  haystack?: readonly string[];
  /** Paths never to delete, whatever the catalog says. */
  protect?: readonly string[];
  /** Skip objects modified within this many hours (default 24). */
  keepHours?: number;
  now?: number;
}): SweepPlan {
  const referenced = new Set([...input.referencedPaths].map(normalizeObjectPath).filter(Boolean));
  const protect = new Set((input.protect ?? []).map(normalizeObjectPath));
  const haystack = input.haystack ?? [];
  const keepHours = input.keepHours ?? 24;
  const now = input.now ?? Date.now();

  const unused: SweepObject[] = [];
  const kept: { object: SweepObject; reason: KeptReason }[] = [];
  let reclaimableBytes = 0;

  for (const object of input.objects) {
    const name = normalizeObjectPath(object.name);
    if (!name) continue;

    if (protect.has(name)) {
      kept.push({ object, reason: "protected" });
      continue;
    }
    if (referenced.has(name)) {
      kept.push({ object, reason: "referenced" });
      continue;
    }

    const base = name.slice(name.lastIndexOf("/") + 1);
    if (base && haystack.some((row) => row.includes(base))) {
      kept.push({ object, reason: "referenced-by-name" });
      continue;
    }

    if (keepHours > 0 && object.lastModified) {
      const modified = Date.parse(object.lastModified);
      if (Number.isFinite(modified) && now - modified < keepHours * 3_600_000) {
        kept.push({ object, reason: "recent" });
        continue;
      }
    }

    unused.push(object);
    reclaimableBytes += Math.max(object.size, 0);
  }

  return { unused, kept, reclaimableBytes };
}

/** Count kept objects by reason, for the one-line summary. */
export function summarizeKept(kept: readonly { reason: KeptReason }[]): Record<KeptReason, number> {
  const out: Record<KeptReason, number> = {
    protected: 0,
    referenced: 0,
    "referenced-by-name": 0,
    recent: 0,
  };
  for (const item of kept) out[item.reason] += 1;
  return out;
}
