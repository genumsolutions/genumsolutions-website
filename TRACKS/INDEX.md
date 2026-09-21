# genumsolutions-website TRACKS — app·website sync 2026-09-18

Per-project tracker for the **APP + WEBSITE SYNC / UNIFICATION (2026-09-18)** effort.
Master plan + recovery: `(workspace) guide/APP-WEBSITE-SYNC-PLAN-2026-09-18.md`.

Branches: `main` (only push target) · `dev` (owner backup — never push).
CI: `ci.yml` on `main` · `sync-app-fallback.yml` on `main` + 6h cron.

## Items

### Unification round (2026-09-21, docs-first — no code yet)

| ID | Change | Status |
|---|---|---|
| U-1 | Ecosystem unification registered: `guide/ARCHITECTURE.md` (standards B-1..B-7) + `guide/UNIFICATION-PLAN-2026-09-21.md` (gap ledger W-1..W-6/A-1..A-2, phases P0–P5). Admin tab sets verified ALREADY matching (12 = 12). Remote control stays HALTED (D-1). | REGISTERED |
| U-2 | Next code here (on owner "go P1"): admin field-level parity audit → W-2 (AdminSettings gains programs/pilot/curriculum editors from the app's tab) + W-4 verify | OPEN |
| U-3 | Later phases here: W-1 (home pilot/curriculum from `site_settings`), W-5 (tools/robotics page mirrors app remote UX visually — NO live transport), W-6 (dark-mode tokens) | OPEN |

### App·website sync round (2026-09-18) — all DONE

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
- **RESOLVED (was Phase 5 / FIN-37 / C-6, 2026-09-18):** `app-releases` download-data
  mismatch closed. The app repo's `release.yml` Android-SDK fix (app `1f136f0`) was
  verified by workflow run `35337629173`, which rebuilt + re-uploaded the signed
  3.2.0/53 APK — versioned `genum-solutions-3.2.0.apk` now serves (HTTP 200,
  41,373,801 B), `release.json` has real `size_bytes`, and `sync-app-fallback.yml`
  (workflow run `35339602463`, bot commit `7611bcc`) updated the fallback
  `androidApp.sizeLabel` **34.5 MB → 41.4 MB**. Pulled to local `main` (`7611bcc`).
- Refs: Supabase `bkylfnlybtsujwzropru`, bucket `app-releases`, Vercel prod
  `https://genumsolutions-website.vercel.app`.

*Created 2026-09-18. Update status column on every change; never delete without owner OK.*