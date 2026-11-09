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
```

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

## Backups

`npm run backup` writes `backups/<timestamp>/` (gitignored) with one JSON file
per table declared in `supabase/schema.sql`, a storage manifest, and — with
`--with-images` — the image files. Tables are discovered from `schema.sql`, so
a new migration is covered without touching the script. The free plan has no
point-in-time recovery; this is the recovery path.
