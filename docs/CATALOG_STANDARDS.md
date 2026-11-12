# Catalog & admin standards

This note documents the shared rules for products, availability, and catalog
maintenance so storefront, admin, and future tooling behave consistently.

## Product types and availability

- **Retail / material / service items** (non–project-package): direct purchase is
  controlled by `stock`.
  - `stock > 0`: available to buy (`In stock` on cards/detail; low stock when
    `stock <= 3`).
  - `stock == 0`: **out of stock / unavailable for direct purchase**. The UI must
    not allow adding it to the cart; show an “out of stock / ask about
    availability” state and route inquiries to contact.
- **Project packages** (`productType === "Project package"`): quote-based. They
  use the quote/contact flow regardless of `stock`. Stock may still be tracked
  for admin reference but does not make a package directly purchasable.
- **Active/visibility**: `active === false` hides a product from public catalogs.
  Prefer retiring/hiding over deleting when a row may be referenced historically;
  delete only clear test residue.

## Admin management

- Set **stock** to the on-hand purchasable quantity (integer, `0` = out of stock
  for retail items). Keep it updated as inventory changes so cards, filters, and
  detail pages stay accurate. Admin catalog lists (products and project packages)
  show stock badges (in/low/out/hidden) and a stock filter to help find items that
  need restock or hiding. The admin dashboard products stat reports low-stock and
  out-of-stock counts to surface inventory issues quickly.
- Use **Hide/Show** for visibility; use **category/product type** consistently
  with the catalog scopes in `lib/catalog.ts` (`components`, `models`, `cars`,
  `projects`) so items appear in the correct public section.
- **Images**: each product should have its own distinct image reference. Avoid
  sharing one storage object across products; run `npm run photos:audit` to find
  placeholders or copied/shared-image stand-ins and replace them with real shots.
- **SKUs** must be unique across active catalog rows; run `npm run catalog:dupes`
  (or `catalog:dupes -- --strict`) to detect collisions/test residue.

## Health, storage, and releases

- Run `npm run health:check` before/after bulk catalog changes (and in a
  credentialed CI/scheduled job) — it runs `limits`, `images:verify`, and
  `catalog:dupes --strict`.
- `npm run images:verify` / `images:sweep` keep product image references valid and
  the bucket free of unreferenced objects (see `docs/STORAGE_BUDGET.md`).
- App APKs in `app-releases` follow the retention rule “`release.json` + latest +
  current versioned APK + one previous”; enforce with `npm run releases:trim`
  (`--apply` on publish). See `docs/STORAGE_BUDGET.md`.
- Unpriced recovery kits live in `data/kits-to-price.json` (from
  `data/catalog-lost-2026-09-23.json`); fill `priceNpr` and insert insert-only.

## UI/card consistency

- Shared card/container primitives live in `lib/styles.ts` (`cardClass`,
  `pageSectionClass`, etc.). Prefer these over ad-hoc card styling to keep
  padding, borders, and overflow behavior consistent.
- Product cards show availability (in stock / low stock / out of stock) and must
  stay readable (wrapped names, consistent text block height). Keep catalog and
  detail availability messaging aligned.
- Product structured data (`components/ProductJsonLd.tsx`) must reflect the same
  rules: retail in-stock → `InStock`, retail out-of-stock → `OutOfStock`,
  project packages → `PreOrder` (quote/scoped). Keep price/URL/image accurate.

## Checkout and ordering

- Only **active, in-stock, directly purchasable (non–project-package)** retail
  items with a valid price may be checked out. Quantities are clamped to available
  stock.
- The server always re-prices and validates cart lines from the catalog
  (`lib/checkout.ts` `priceRequestedItems`, used by COD and gateway checkout
  routes); client-sent prices/names are not trusted.
- The checkout UI must clearly flag unavailable cart lines (out of stock, hidden,
  quote-only, or missing) and block payment until they are removed, so orders
  cannot be placed for unavailable items. Keep messaging consistent with product
  cards/detail/admin.

## Related tooling

- `docs/STORAGE_BUDGET.md` — image/storage budget and measured headroom.
- `docs/PHOTO_AUDIT.md` — prioritized list of products needing real photos
  (`npm run photos:audit`).
- `scripts/releases-trim.ts`, `scripts/health-check.mjs` — retention and
  guardrails.
