# Free-tier limits — measured 2026-11-12

Everything runs on free plans (Supabase Free, Vercel Hobby, GitHub Actions on
public repos). `npm run limits` prints the live numbers below against the
ceilings — run it before a busy week, not after a failure.

## Measured now

| Resource          | Used     | Free ceiling | Headroom                           |
| ----------------- | -------- | ------------ | ---------------------------------- |
| Supabase database | 13.9 MB  | 500 MB       | 2.8% — 97% left                    |
| Supabase storage  | 161.9 MB | 1 GB         | 15.8% — 86% left                   |
| Auth users (MAU)  | 3        | 50,000       | 0%                                 |
| Auth email        | 2/hour   | 2/hour       | **0 — this is the binding limit**  |
| Repos             | public   | public       | Actions minutes are free/unlimited |

Storage detail: `app-releases` 159.0 MB across 5 objects (4 APKs at ~39.8 MB
plus `release.json`), `product-images` 2.9 MB across 29 objects.

Rate limits in force, all per IP and all far above this store's traffic — signup
and verify 30 per 5 min, token refresh 150 per 5 min, anonymous 30 per 5 min,
and OTP 30 per 5 min.

## The only limit that breaks production

Auth email is capped at **2 per hour** on Supabase's built-in sender, and the
cap cannot be raised without custom SMTP. With email confirmation now required
(`mailer_autoconfirm = false`), registrations past the cap fail with
"Could not register. Try again." Fix: add SMTP (see
`TRACKS/AUTH-REGISTRATION.md`), then raise `rate_limit_email_sent`.

## Storage growth rule

Each app release publishes a new APK (~40 MB) and rewrites
`genum-solutions-latest.apk`, so two releases ≈ 80 MB. At 1 GB that is roughly
12 releases before the bucket is full. Keep **latest + the two most recent
versions** and delete older APKs when a release goes out; the `/app` page only
links the current and previous builds. Current dead weight: `3.2.9` and
`3.3.0` (~79 MB) can be deleted whenever an old-version rollback is no longer
wanted.

## Free-plan behaviour to know about

- A Free Supabase project **pauses after 7 days without activity**. Normal store
  traffic counts as activity; if the site ever goes quiet for a week, expect a
  resume click in the dashboard (or a paused API) on the next visit.
- Free egress is 5 GB/month. Current traffic is nowhere near it; images are
  already served through `next/image` (AVIF/WebP) and the CSP allows only the
  Supabase host.
- Vercel Hobby has no `vercel.json` crons here, so nothing is scheduled on the
  web host; the 6-hour `sync-app-fallback` workflow runs on GitHub Actions,
  which is free for these public repos.
- CI's `db-drift` job needs `NEXT_PUBLIC_SUPABASE_URL` and
  `SUPABASE_SERVICE_ROLE_KEY` repo secrets. Until they exist it **skips with a
  warning** (a red X only tells you the secret is missing); with them it fails
  on any live/schema mismatch.
