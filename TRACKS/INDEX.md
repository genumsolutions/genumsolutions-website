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
| U-2 | **P1 DONE** `3d1e210`: tab ORDER aligned to the app (Dashboard first — B-6); admin-parity test added; audit → `guide/ADMIN-PARITY-MATRIX.md` (12/12 mirrored; W-2 already closed since 2026-09-18). | DONE |
| U-3 | **P2 DONE** `e00a956`: web home renders curriculum highlights + pilot costing from the shared tables (W-1; fallback preserved). **P3 DONE** `61af029`: /tools `RoboticsFleet` — 9-mode fleet catalogue mirroring the app Remote screen, visual only (D-1 parked). **P4 DONE** `68a06fc`: content/settings/journal admin writes now log activity (dotted vocabulary). **P5 DONE**: freeze — vitest 49/49, tsc/lint clean, CI green. | DONE |
| U-4 | Owner calls DECIDED + EXECUTED 2026-09-21 (committed + pushed same day, gates green): **W-6** web dark mode — the old "light-only" audit was wrong (globals.css already had a full dim theme); this round added the app-matching 3-way System/Light/Dim preference (OS-follow listener, pre-paint resolution), stores the choice on `profiles.theme_preference` (shared with the app through Supabase), and a dim coverage-guard test (caught + fixed 2 real dark-on-dark chip bugs). **W-3** web-push WITHOUT Firebase (owner: "keep all features, no Firebase for now") — VAPID Web Push end-to-end: `web_push_subscriptions` table, sw.js handlers, subscribe/unsubscribe APIs (RLS), account card + checkout opt-in, edge function sends Web Push (active) + Expo (dormant until Firebase); RFC 8291/8292 WebCrypto core verified by encrypt/decrypt roundtrip tests. Gates: tsc · lint · vitest **68/68** · build green. Owner deploy steps when ready: db:apply, function deploy, VAPID secrets (already in local .env.local), optional trigger SQL. | CLOSED (code; deploy pending) |

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