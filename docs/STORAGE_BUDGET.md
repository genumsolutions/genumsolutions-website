# Storage & free-tier budget

Both clients share one Supabase project on the free plan, so every photo, row
and function call is spent out of the same small allowance. This file is the
contract; `lib/image-limits.ts` (website) and `src/lib/imageLimits.ts` (app)
are the code, and a test on each side fails if the two drift apart.

## What the free plan actually gives us

| Resource                  | Free allowance           | What we do about it                                                                                           |
| ------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------- |
| Storage                   | 1 GB                     | Images capped at 300 KB each, 8 per product (≤2.4 MB/product). Re-optimizer below keeps the bucket small.     |
| Storage egress            | 5 GB / month             | Cards now serve ~40–120 KB instead of ~750 KB, so ~10× more views per GB.                                     |
| Database                  | 500 MB                   | Text only; profile/settings JSON capped at 4 000-char descriptions and 8 gallery URLs.                        |
| Edge Function invocations | 500 000 / month          | One call per import preview/save, none on page views.                                                         |
| Edge Function runtime     | 150 s wall, 256 MB       | Downloads capped at 4 MB so one huge photo cannot exhaust memory; gallery fetches capped at 8 images.         |
| Vercel (Hobby)            | 100 GB bandwidth / month | `next/image` serves AVIF/WebP with a long cache; admin panels are code-split and only the visited tab mounts. |

## The image budget

| Rule                    | Value                                                                                  |
| ----------------------- | -------------------------------------------------------------------------------------- |
| Largest accepted upload | 8 MB                                                                                   |
| Stored long edge        | ≤ 1600 px                                                                              |
| Stored bytes            | ≤ 300 KB (quality steps down to 55, then dimensions shrink)                            |
| Format                  | WebP from the website encoder (sharp); JPEG from the edge encoder (imagescript)        |
| Images per product      | 8 (primary + 7 gallery)                                                                |
| Exception               | Animated GIFs are stored as-is — flattening them to one frame would change the product |

## Where it is enforced

| Path                                    | File                                                              |
| --------------------------------------- | ----------------------------------------------------------------- |
| Admin file upload (`/api/admin/upload`) | `lib/image-budget.ts` → `optimizeImage()`                         |
| Every product save (gallery clamp)      | `lib/content-store.ts` → `clampGallery()`                         |
| Import by link, on either client        | `supabase/functions/link-import/index.ts` → `prepareForStorage()` |
| Existing bucket contents                | `scripts/optimize-images.ts`                                      |
| Orphaned objects                        | `scripts/sweep-images.ts` + `lib/image-sweep.ts`                  |

The app has no encoder of its own: it never uploads bytes directly, every image
it stores arrives through `link-import`, which is where the app-side cap is
applied. `src/lib/imageLimits.ts` mirrors the numbers so the UI can state them.

## Maintenance commands

```bash
npm run images:optimize -- --dry-run   # measure, change nothing
npm run images:optimize                # re-encode anything over budget + repoint rows
npm run images:verify                  # fail if a product points at a missing file
npm run images:sweep                   # list files no row references (dry run)
npm run images:sweep -- --delete       # remove those files
npm run backup -- --with-images        # snapshot every table + the image bytes
npm run health:check                   # guardrail: limits + images:verify + catalog:dupes --strict
npm run releases:trim                  # dry-run app-releases retention (current + one previous)
npm run releases:trim -- --apply       # delete old APK builds per the retention rule
```

`health:check` is the single guardrail command: it runs `limits`, `images:verify`,
and `catalog:dupes --strict` and exits non-zero on missing image references,
SKU/photo/test-residue warnings, or active name-duplicate rows to retire. It needs
live DB/storage credentials (and `SUPABASE_ACCESS_TOKEN` for `limits`; pass
`--skip-limits` if that token is unavailable). Run it before/after bulk catalog
changes and in CI when secrets are available. Pre-commit stays fast/offline (lint
only); run `health:check` manually or in a scheduled/credentialed job to catch
storage growth and collisions early.

`releases:trim` reads `release.json` from the `app-releases` bucket to identify
the current versioned APK and refuses to delete anything if it cannot. Dry-run by
default; pass `--apply` to remove builds beyond the current + one previous. Run it
on each app publish.

`images:optimize` writes the new URL to every `products` row _before_ deleting
the original, so an interrupted run leaves the storefront serving the old file
rather than a broken image.

`images:sweep` is the opposite job — it removes files nothing points at, which
happens when an image is replaced or a product is deleted. It is a dry run
unless you pass `--delete`, and it fails closed: it scans **every** table
PostgREST exposes (39 today, discovered from the API schema rather than a
hand-written list), and refuses to delete if any table read fails or if the
scan finds zero references. An object is kept when its exact path or its bare
file name appears in any row, when it changed in the last 24 h (`--keep-hours`
to change), or when it is protected — currently
`genum-product-placeholder.webp`. The judgement lives in `lib/image-sweep.ts`
with unit tests, so the rules are pinned independently of live data.

Run it after bulk catalog edits (`images:verify` first — a missing file is a
bug; an unreferenced one is just weight).

## Measured results (2026-11-09)

| Metric                    | Before          | After                |
| ------------------------- | --------------- | -------------------- |
| `product-images` bucket   | 23.56 MB        | 2.90 MB (29 objects) |
| Average image             | 754 KB          | 102 KB               |
| Source images over 2 MB   | 4 (2.9 MB PNGs) | 0                    |
| Referenced images checked | —               | 63, all resolve      |
| Unreferenced objects      | 3               | 0                    |

One live import smoke test through the deployed edge function: an 810 KB source
photo stored at **154 KB**, 1600 px, JPEG.

## Recovering lost rows (and why it keeps happening)

The database was rebuilt from scratch after oversized images filled the free
allowance, and the rebuild did not carry the old catalog across: on 2026-11-12
the live project held 17 products, 0 journal posts, 0 training programs and 0
curriculum rows, while `backups/2026-11-09T09-38-58/` still had 59 of them. The
images were gone with them — 43 product rows pointed at storage objects that no
longer existed, and the old project (`bkylfnlybtsujwzropru`) no longer resolves,
so nothing could be fetched from there.

The 38 rows that only existed in git history are kept in
`data/catalog-lost-2026-09-23.json`. That file is **versioned** (unlike
`backups/`, which holds dumps with profile data and stays gitignored), so the
recovered catalog survives a fresh clone.

Two scripts apply the recovery, and both are insert-only and dry-run by default:

```bash
npm run db:restore -- --dry-run          # what the newest backup would add
npm run db:restore -- --apply            # insert missing rows, skip existing ids
npm run catalog:restore -- --dry-run     # the 38 products recovered from git
npm run catalog:restore -- --apply       # insert them + upload their photos
npm run catalog:restore -- --heal-images # repoint rows at missing files
npm run catalog:restore -- --heal-images --apply
```

Restores never update or delete a live row: a restore that overwrote current
edits would be worse than the loss it repairs. Where two ids describe the same
product (`lord-shiva-statue` vs `lord-shiva-statue-seated-blessing-pose-3d-print`)
both are kept and the newer one is retired by `catalog:dupes`.

`--heal-images` resolves a dead `image_url` three ways, cheapest first: an object
with the same stem and another extension (the `.jpg` that became `.webp`), the
surviving original in `public/media/products/`, then the protected placeholder.
It also prunes gallery entries that point at deleted objects. After it ran, the
bucket was 52 objects / 4.6 MB with **0 missing references**.

## Keeping the row count and the byte count down

The rule of thumb: bytes are the scarce resource, and repeated rows are what
multiply them. Two mechanisms, both reversible:

- **`npm run catalog:dupes`** reports two families of repeat — the same product
  entered twice (same normalised name) and shared data (`sku`/photo used by more
  than one product, which needs a real fix rather than a hide). `--apply` sets
  `active = false` on the newer copy of a name group and appends a note; it never
  deletes a row, so the admin panel can bring it back.
- **`npm run images:sweep -- --delete`** removes objects no row references, after
  the fail-closed checks described above. Run `images:verify` first.

Before adding a product, check it is not already there:
`npm run catalog:dupes` lists name, SKU and photo collisions in one pass. Prefer
editing an existing row (new variant, updated price) over inserting a near-copy —
each extra row also tends to drag its own copy of a photo into the bucket.

## Backups

## Current headroom (measured 2026-11-12)

| Resource         | Used   | Allowance | Note                                                                     |
| ---------------- | ------ | --------- | ------------------------------------------------------------------------ |
| Database         | 15 MB  | 500 MB    | 3% — text only, restored rows cost almost nothing                        |
| Storage          | 125 MB | 1 GB      | 12% — `app-releases` trimmed to current + one previous (4 objects)       |
| `product-images` | 5.7 MB | —         | 62 objects (shared photos copied per product), 0 missing references      |
| Storage egress   | —      | 5 GB / mo | One APK download is ~40 MB: ~125 downloads exhaust the month's allowance |

`app-releases` is the one bucket that can still take the site down: at ~40 MB
each, a handful of builds eat storage and the free plan's 5 GB egress is only
about ~125 downloads per month. **Retention rule:** keep exactly the current
release artifacts (`release.json`, `genum-solutions-latest.apk`, and the
versioned APK it names) plus **one** previous versioned APK — delete every older
build. An old APK is dead weight, not history; the app can be rebuilt from its
git tag. (Applied 2026-11-12: trimmed to `release.json` + `latest` + `3.4.0` +
`3.3.0`, dropped `3.2.9`, freeing ~40 MB.)

`npm run backup` writes `backups/<timestamp>/` (gitignored) with one JSON file
per table declared in `supabase/schema.sql`, a storage manifest, and — with
`--with-images` — the image files. Tables are discovered from `schema.sql`, so
a new migration is covered without touching the script. The free plan has no
point-in-time recovery; this is the recovery path.
