# genumsolutions-website TRACKS — app·website sync 2026-09-18

Per-project tracker for the **APP + WEBSITE SYNC / UNIFICATION (2026-09-18)** effort.
Master plan + recovery: `(workspace) guide/APP-WEBSITE-SYNC-PLAN-2026-09-18.md`.

Branches: `main` (only push target) · `dev` (owner backup — never push).
CI: `ci.yml` on `main` · `sync-app-fallback.yml` on `main` + 6h cron.

## Items

| ID | Change | Status |
|---|---|---|
| A1 | Fix `lib/company.ts` `androidApp` corruption | DONE |
| A2 | Fix `scripts/sync-app-fallback.mjs` regexes (idempotent) | DONE |
| A3 | `sync-app-fallback.yml`: typecheck gate before auto-commit | DONE |
| A4 | Git reconcile: `pull --ff-only`, commit A1–A3, push | DONE |
| A5 | `.env.example` / `.env.local` cleanup + drop empty `app/api/checkout/stripe/` | DONE |
| A6 | README font/token reconciliation | DONE |
| A7 | Sitemap phantom-route removal | DONE |
| A8 | Tidy empty scaffolds (`admin/(dashboard)/`, `portfolio/`, `lib/api/`, `LOGO/`, `INVENTORY/`) | DONE |
| A9 | `tests/company.test.ts` fallback-shape guard | DONE |
| C1 | README shared-contract section | DONE |
| C2 | Verify `typecheck`/`lint`/`test:ci` green | DONE |

## Notes

- **Critical preexisting:** `lib/company.ts:66-69` corrupted (`version: '3.2.0',,`,
  `sizeLabel: '34.5 MB',',`, merged `arch`/`apkUrl` line). Typecheck = 5 errors.
  Cause: `scripts/sync-app-fallback.mjs` regex bugs compounded by `sync-app-fallback.yml`
  (push + 6h cron) auto-committing corruption via `github-actions[bot]`.
  **Resolved:** bot commits `159e14d` + `bd69e29` merged in, corruption cleaned, regexes
  made self-healing + a `validate` step now hard-fails the workflow before any commit if
  `lib/company.ts` stops typechecking. Current HEAD `2766975`.
- **Guard:** `tests/company.test.ts` now asserts the `androidApp` fallback shape (semver,
  positive versionCode, `NN.N MB` size label, app-releases bucket URLs) so any future
  malformed fallback fails the test suite loudly.
- **Ledger-vs-reality:** workspace `GUIDE.md` VSC item 1 claims `bump-version.mjs` writes
  website `lib/company.ts`; the code deliberately does NOT anymore (fallback syncs only via
  `sync-app-fallback.mjs` after a real upload). Corrected in `guide/GUIDE.md` this session.
- Env behind the codebase: `.env.local` holds LIVE keys (gitignored). Do not print. Advise rotation.
- **Open (Phase 5 / FIN-37, 2026-09-18):** `app-releases` download-data mismatch — fallback
  claims 34.5 MB, `latest.apk` is actually 41,366,097 B (~41.4 MB), and versioned
  `genum-solutions-3.2.0.apk` is MISSING (HTTP 400). Fix requires re-running
  `upload-release.mjs` from `C:\bs` for 3.2.0 then `sync-app-fallback.mjs`. See
  `guide/RELEASE-FINALIZATION-PLAN.md` finding C-6.
- Refs: Supabase `bkylfnlybtsujwzropru`, bucket `app-releases`, Vercel prod
  `https://genumsolutions-website.vercel.app`.

*Created 2026-09-18. Update status column on every change; never delete without owner OK.*