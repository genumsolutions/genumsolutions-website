// =====================================================================
// image-limits.ts — the numbers, and the pure helpers, with no sharp import
// so any server module (catalog store, routes) can enforce the budget without
// pulling the native encoder into its bundle. The encoder lives next door in
// lib/image-budget.ts, which re-exports everything here.
//
// Policy (mirrored in docs/STORAGE_BUDGET.md, in both repos):
//   • max upload accepted  : 8 MB
//   • max stored long edge : 1600 px
//   • max stored bytes     : 300 KB per image
//   • max images per item  : 8 (primary + 7 gallery)
// Animation is the one exception: an animated GIF is stored as-is, because
// flattening it would change the product.
// =====================================================================

export const IMAGE_BUDGET = {
  /** The largest file we accept from an admin upload or an import download. */
  maxUploadBytes: 8 * 1024 * 1024,
  /** Long-edge ceiling for anything we store. */
  maxEdge: 1600,
  /** Hard ceiling for the encoded file; we step quality down to meet it. */
  maxStoredBytes: 300 * 1024,
  /** WebP quality used first. */
  quality: 80,
  /** Floor for the quality search — never store mush. */
  minQuality: 55,
  /** Images allowed per product (primary + gallery). */
  maxImagesPerItem: 8,
} as const;

export const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
] as const;

/** "1.2 MB" style label for admin UI + logs. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 100 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}

/**
 * Gallery policy used by every write path: dedupe, drop blanks, keep the first
 * `maxImagesPerItem`. Returns the list the caller should persist.
 */
export function clampGallery(urls: readonly unknown[]): string[] {
  const seen = new Set<string>();
  const kept: string[] = [];
  for (const raw of urls) {
    if (typeof raw !== "string") continue;
    const url = raw.trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    kept.push(url);
    if (kept.length >= IMAGE_BUDGET.maxImagesPerItem) break;
  }
  return kept;
}
