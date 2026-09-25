/**
 * U-35 (2026-09-25): single source of truth for the product-id slug.
 *
 * Three places slugify a product title and they must agree or a product gets
 * one id on the website and another in the app:
 *   - supabase/functions/link-import/index.ts  (extractor default, "untitled-product")
 *   - components/admin/AdminProducts.tsx        (was silently producing "")
 *   - mobile/src/services/adminService.ts       (app parity, see U-35e)
 *
 * A non-latin-only title (e.g. a Devanagari or CJK product name) normalises to
 * the empty string; the `untitled-product` fallback is what stops the extractor
 * from writing a row with a blank primary key.
 */
export const UNTITLED_PRODUCT_ID = "untitled-product";

export function slugifyProductId(raw: string | null | undefined): string {
  return String(raw ?? "")
    .toLowerCase()
    .trim()
    .replace(/&(amp;)?/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Same as {@link slugifyProductId} but never returns an empty id. */
export function productIdFromTitle(raw: string | null | undefined): string {
  return slugifyProductId(raw) || UNTITLED_PRODUCT_ID;
}
