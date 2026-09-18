# genumsolutions-website TRACKS — app·website sync 2026-09-18

Per-project tracker for the **APP + WEBSITE SYNC / UNIFICATION (2026-09-18)** effort.
Master plan + recovery: `(workspace) guide/APP-WEBSITE-SYNC-PLAN-2026-09-18.md`.

Branches: `main` (only push target) · `dev` (owner backup — never push).
CI: `ci.yml` on `main` · `sync-app-fallback.yml` on `main` + 6h cron.

## Items

| ID | Change | Status |
|---|---|---|
| A1 | Fix `lib/company.ts` `androidApp` corruption | PENDING |
| A2 | Fix `scripts/sync-app-fallback.mjs` regexes (idempotent) | PENDING |
| A3 | `sync-app-fallback.yml`: typecheck gate before auto-commit | PENDING |
| A4 | Git reconcile: `pull --ff-only`, commit A1–A3, push | PENDING |
| A5 | `.env.example` / `.env.local` cleanup + drop empty `app/api/checkout/stripe/` | PENDING |
| A6 | README font/token reconciliation | PENDING |
| A7 | Sitemap phantom-route removal | PENDING |
| A8 | Tidy empty scaffolds (`admin/(dashboard)/`, `portfolio/`, `lib/api/`, `LOGO/`, `INVENTORY/`) | PENDING |
| A9 | `tests/company.test.ts` fallback-shape guard | PENDING |
| C1 | README shared-contract section | PENDING |
| C2 | Verify `typecheck`/`lint`/`test:ci` green | PENDING |

## Notes

- **Critical preexisting:** `lib/company.ts:66-69` corrupted (`version: '3.2.0',,`,
  `sizeLabel: '34.5 MB',',`, merged `arch`/`apkUrl` line). Typecheck = 5 errors.
  Cause: `scripts/sync-app-fallback.mjs` regex bugs compounded by `sync-app-fallback.yml`
  (push + 6h cron) auto-committing corruption via `github-actions[bot]`.
  Origin HEAD `bd69e29` is the current corrupt bot commit; local `main` is 1 behind.
- **Ledger-vs-reality:** workspace `GUIDE.md` VSC item 1 claims `bump-version.mjs` writes
  website `lib/company.ts`; the code deliberately does NOT anymore (fallback syncs only via
  `sync-app-fallback.mjs` after a real upload). Corrected in `guide/GUIDE.md` this session.
- Env behind the codebase: `.env.local` holds LIVE keys (gitignored). Do not print. Advise rotation.
- Refs: Supabase `bkylfnlybtsujwzropru`, bucket `app-releases`, Vercel prod
  `https://genumsolutions-website.vercel.app`.

*Created 2026-09-18. Update status column on every change; never delete without owner OK.*