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
| U-4 | Owner calls DECIDED + EXECUTED 2026-09-21 (committed + pushed same day, gates green): **W-6** web dark mode — the old "light-only" audit was wrong (globals.css already had a full dim theme); this round added the app-matching 3-way System/Light/Dim preference (OS-follow listener, pre-paint resolution), stores the choice on `profiles.theme_preference` (shared with the app through Supabase), and a dim coverage-guard test (caught + fixed 2 real dark-on-dark chip bugs). **2026-09-22: W-6 REDUCED to 2 modes (owner decision #1)** — see U-9. **W-3** web-push WITHOUT Firebase (owner: "keep all features, no Firebase for now") — VAPID Web Push end-to-end: `web_push_subscriptions` table, sw.js handlers, subscribe/unsubscribe APIs (RLS), account card + checkout opt-in, edge function sends Web Push (active) + Expo (dormant until Firebase); RFC 8291/8292 WebCrypto core verified by encrypt/decrypt roundtrip tests. Gates: tsc · lint · vitest **68/68** · build green. Owner deploy steps when ready: db:apply, function deploy, VAPID secrets (already in local .env.local), optional trigger SQL. | CLOSED (code; deploy pending) |
| U-5 | **Deploy + activation round DONE (2026-09-21):** `admin-set-role` deployed via CLI + verified end-to-end (role lands, audit row, self-demotion guard); live DB schema applied + catalog-verified; `push-order-status` deployed + VAPID/PUSH_TRIGGER secrets set; order-status trigger armed (pg_net) with the gateway-bearer fix (`b7a72b0`); `NEXT_PUBLIC_VAPID_PUBLIC_KEY` on Vercel (all envs) + production redeploy. **P3 machine review 26 PASS · 1 SNAG · 0 FAIL · 2 DEFER** (`scripts/p3-review.mjs`; snag = dim contrast on /admin, owner adjudicates). SW production bugs found + fixed: `ServiceWorkerRegister` load-race (`99076bf`) and the duplicate-`/tools` precache that never let the SW activate (`f52b097` + guard `4d257b8` + extractor `53098b5`). Harness: `scripts/p3-review.mjs` + `scripts/push-e2e.mjs`. | CLOSED (P3 owner visual pass open) |

| U-8 | **Tiers + robot-settings E2E-verified on prod (2026-09-22):** registered-only `/app` download gate, pro-gated remote window, per-user `robot_user_settings` store (schema applied live), admin tier toggle + per-user robot-settings manager in the Users tab, app 3.2.5 (58) built + live with the pro gate + Robot Preferences screen. New harness `scripts/tier-robot-e2e.mjs`: **23/23 PASS** vs production (provisioning, own/cross-user CRUD, shape guard, pro-gate free-block→promote-allow lifecycle, 401/403/405 negatives, full cleanup). Caught + fixed one real bug: shape guard string values uncapped (`35102c3`). Pro ≠ admin proven (pro-only user correctly 403s cross-user). | DONE |
| U-9 | **W-6 → TWO MODES (owner decision #1, 2026-09-22; website `5d2f5cc` + app `78e10f9`):** System removed from the header toggle (no Monitor, no matchMedia OS-follow); `lib/theme.ts` = `'light'|'dim'` only (`DEFAULT='light'`); legacy stored `'system'` → **dim** on read, unknown/missing → light; pre-paint resolver returns a literal (no `prefers-color-scheme`); `/api/customer/theme` + `/api/user-settings` accept only light/dim; `customer-store` row type narrowed; `tests/theme.test.ts` rewritten (suite 12→10; vitest 71/71). App parity: AppContext restore maps legacy `system/dim`→dark + writes back; settingsService stores canonical light/dim AND the `genum-theme-mode` cache-key bug is fixed (dark survives restarts). No DB migration, no version bump. Gates green both repos. **Pushed → Vercel deployed → prod E2E ALL GREEN: tier-robot 23/23, admin-set-role 6/6, p3-review 27 PASS/0 SNAG/0 FAIL/2 DEFER** (§2 rewritten for 2-mode). | DONE |
| U-6 | **CI-repair + P3 snag resolution round (2026-09-22):** ① CI red since `4d257b8` on every push + the 6h fallback cron — 4 TS strict errors in `tests/sw-shell.test.ts` (RegExp `matchAll` capture groups typed `string \| undefined` under `noUncheckedIndexedAccess`) failed the `tsc --noEmit` gates of both `ci.yml` and `sync-app-fallback.yml`; fixed `f3491d7`, both workflows green. ② P3 snag ROOT-CAUSED + FIXED `70a7c00`: the /admin dim hard-fails were the order-status `<select>`/`<option>` elements — bare form controls carry no utility classes, so the class-override dim layer never reached them (ratio 1.1; visible only after the Orders neighbour panel loaded rows → run-to-run variance). globals.css gained element-level dim rules (select/option/input/textarea) + `color-scheme: dark`; harness hardened (stats-paint wait, alpha compositing, `E2E_DUMP_CONTRAST=1` dump). **Official re-run on prod: 27 PASS · 0 SNAG · 0 FAIL · 2 DEFER** (§2 /admin 0 hard / 0 soft of 264). Gates: tsc · lint · vitest 73/73 · CI green. | DONE |
| U-10 | **AGREED 2026-09-22 — DB residue cleanup + RBAC levels (customer/staff/admin/owner) + Admin Settings→Content reorg (web + app).** Owner decisions: ① staff = everything EXCEPT deletions; ② delete-user = OWNER ONLY (`genumsolutions`, sole owner account); ③ roles = customer/staff/admin/owner; ④ Content tab (mostly empty) absorbs the content-shaped editors currently in Settings — Training programs, Pilot cost lines, Curriculum highlights — rebuilt as unified **windowed editors (list + right editor pane, row actions Preview / Edit / Hide(active) / Delete)** exactly like Products/Projects/Services, with the portal preview modal; Settings keeps only Company info. Delete buttons hidden for staff everywhere (web + app). Plan: Phase A `scripts/cleanup-test-residue.mjs` (dry-run default, `--apply`) removes 18 `@genumtest.invalid` users + 6 `P3 smoke probe` orders → verify 0; Phase B RBAC (schema.sql role check + owner migration, RLS read=staff+/delete=admin+, edge `admin-set-role` staff support + owner guard, `lib/admin.ts` rank helpers, route re-gating, owner-only delete-user, staff-access E2E); Phase C content reorg both clients. | PLANNED → IN PROGRESS (no tags; no version bump — app rides OTA) |

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