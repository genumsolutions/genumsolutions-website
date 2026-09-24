// =====================================================================
// product-image.ts — W1 (2026-09-24): link-import image parity helpers.
//
// The link-import edge function stores imported product images in the
// `product-images` storage bucket and writes back the public storage URL.
// next/image (remotePatterns) and the site CSP only allow that bucket, so
// any OTHER image host renders as a broken image on the website even
// though the native app (no domain allow-list) would show it.
//
// These pure helpers decide whether an image URL is already a safe
// storage URL (pass-through) or a foreign URL that must be converted by
// the edge `upload-image` action. Kept dependency-free and unit-testable.
// =====================================================================

/** Supabase storage hosts the row's image may live on. */
export function isStorageImage(url: string): boolean {
  const value = url.trim();
  if (!value) return false;
  try {
    const parsed = new URL(value);
    // The shared project (and any future sibling project ref) serves
    // /storage/v1/object/public/<bucket>/... — accept only https.
    return (
      parsed.protocol === "https:" &&
      parsed.hostname.endsWith(".supabase.co") &&
      parsed.pathname.startsWith("/storage/v1/object/")
    );
  } catch {
    return false;
  }
}
