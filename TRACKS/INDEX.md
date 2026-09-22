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
| U-10 | **AGREED 2026-09-22 — DB residue cleanup + RBAC levels (customer/staff/admin/owner) + Admin Settings→Content reorg (web + app).** Owner decisions: ① staff = everything EXCEPT deletions; ② delete-user = OWNER ONLY (`genumsolutions`, sole owner account); ③ roles = customer/staff/admin/owner; ④ Content tab (mostly empty) absorbs the content-shaped editors currently in Settings — Training programs, Pilot cost lines, Curriculum highlights — rebuilt as unified **windowed editors (list + right editor pane, row actions Preview / Edit / Hide(active) / Delete)** exactly like Products/Projects/Services, with the portal preview modal; Settings keeps only Company info. Delete buttons hidden for staff everywhere (web + app). Plan: Phase A `scripts/cleanup-test-residue.mjs` (dry-run default, `--apply`) removes 18 `@genumtest.invalid` users + 6 `P3 smoke probe` orders → verify 0; Phase B RBAC (schema.sql role check + owner migration, RLS read=staff+/delete=admin+, edge `admin-set-role` staff support + owner guard, `lib/admin.ts` rank helpers, route re-gating, owner-only delete-user, staff-access E2E); Phase C content reorg both clients. | **PHASE B DONE 2026-09-22** (web `0bc4d2d` + `8cdbe8f`, app `b8a87bf` — RBAC committed+pushed both repos; edge functions dashboard-deploy pending). Live-verified via `scripts/staff-access-e2e.mjs` → **25/25 PASS** vs Vercel prod + Supabase DB: staff reads/edits/all-lists ≈ 200, staff deletes/role-change/robot-settings-delete → 403 (fix `8cdbe8f`), admin owner-only delete-user → 403, customer/anon → 401/403; residue cleanup AUTO-promotes live DB (staff E2E auto-purge + `cleanup-test-residue.mjs`). **Phase A residue already at 0** (purged 18 test users + 6 orders live, 2026-09-21). App tsc + vitest 76/76 green. Next: deploy web+app edge functions via dashboard, then Phase C. | PHASE B CLOSED 2026-09-22 (edge fns DEPLOYED ACTIVE web+app via CLI, PAT revoked, secrets debt 0) |

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

## Secrets / credentials registry (names only — NEVER write values here)

| Secret | Where it lives | Scope | Rotation note |
|---|---|---|---|
| `SUPABASE_ACCESS_TOKEN` (CLI PAT) | ~~`.env.local`~~ **removed from file** — only the live CLI session in `~/.supabase/access-token` remains (`sbp_…` created 2026-09-22 **for Phase B edge-fn deploy**) | website+app shared project `genumsolutions` (ref `bkylfnlybtsujwzru`) | **✅ REVOKED 2026-09-22** (dashboard → Account → Access Tokens → delete; user confirmed "deleted tokens"). Rotation debt cleared — Phase B secrets debt zero. |
| `SUPABASE_SERVICE_ROLE_KEY` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | website `.env.local` + Vercel env; app `.env.local` | same project | Only needed per-repo; do not commit. |
| `SUPABASE_DB_URL` | website `.env.local` | pooler (DB) host `db.bkylfnlybtsujwzru.supabase.co` | Used by `scripts/apply-schema.ts`. |

## Deployed edge functions (live project ref `bkylfnlybtsujwzru`)

| Function | Slug | Status (as of 2026-09-22) |
|---|---|---|
| admin-set-role | admin-set-role | ACTIVE v4 |
| admin-delete-user | admin-delete-user | ACTIVE v1 |

_Cli deployed via `supabase functions deploy <fn> --project-ref <ref>`._

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

*Created 2026-09-18. Update status column on every change; never delete without owner OK.*| U-11 | **AUDIT 2026-09-22 (Phase C scoping, owner chose 'audit all panels first')**: WEB Content tab today = ONLY homepage title/body (mostly empty, matches U-10). WEB AdminSettings.tsx owns ALL 3 Phase-C nouns as sub-forms bur*ied in the big Settings form: '(Training programs / Pilot cost lines / Curriculum highlights)'. So Phase C = extract these 3 sub-form blocks OUT of AdminSettings into windowed editor panels under the Content tab (web) + the app Content tab (parity), moving Settings down to Company info ONLY � exactly U-10. Also confirmed in-scope at each client: web Services + Journal are operational (not content-shaped); app Content tab = Daily/service content; app Program editors live in config/programs.ts + programsService.ts. | REGISTERED | PHASE C SCOPING AUDIT DONE - move 3 sub-forms; **Decision2 2026-09-22 (owner): homepage title/body in Content stays a PLAIN form (not windowed) - 3 windowed editors render below it; app Content keeps Daily/service block + adds same 3 below.** |

## Phase C session handoff � BEFORE (written 2026-09-22, before implementation)

**Goal:** In both clients, the 3 "content" editors (Training programs / Pilot cost lines / Curriculum highlights) currently buried inline in the Settings form+screen move into **windowed row-editors under the Content tab** (web: under homepage plain form; app: Content tab), reusing ONE shared windowed-row-editor engine per client. Settings shrinks to **Company info only** (both clients). Staff parity: view/edit OK, delete hidden (Phase B rule) � must NOT regress.

**Orientation (read this first):**
- Web engine to REUSE by parameterizing `kind`: the windowed row-editor in `components/admin/AdminServices.tsx` (list + preview/edit/hide/delete, `canDelete` gate, `inputClass`/`styles`, `Pager`, portal preview). Same engine pattern exists in AdminProducts/AdminProducts. **Do not invent a new engine � reuse + parameterize by `kind: 'training' | 'pilot' | 'curriculum'`.**
- Web current state: `AdminContent.tsx` = ONLY homepage title/body plain form (NOT content yet). All 3 content nouns live inline in `AdminSettings.tsx` (state: `programs/pilots/curricula` + `program/pilot/curriculum` + saveProgram/savePilot/saveCurriculum + delete-program/pilot/curriculum, UI sections "Training programs / Pilot cost lines / Curriculum highlights"). API: `PUT /api/admin/settings` (actions `training`/`pilot`/`curriculum`), `DELETE /api/admin/settings?action=...&id=`; `GET /api/admin/settings` returns trainingPrograms/pilotCostLines/curriculumHighlights. `/api/admin/content` = homepage title/body only.
- App current state: `mobile/src/screens/AdminScreen.tsx` (tabs incl. Content+Settings), `mobile/src/config/programs.ts` + `mobile/src/services/programsService.ts` + `adminService.ts` handle the 3 nouns app-side; app Content tab currently = daily/service content. App engine to reuse: the app's own windowed row-editor (mirror of web) � `AdminServices`-shaped editor used in product/services tabs.
- RBAC: gate deletions behind `canDelete` prop (web) / `canDelete` equivalent (app) � staff sees Edit/Preview only, Delete hidden (Phase C MUST keep Phase B E2E 25/25 gate intact).

**Locked decisions (owner-adjudicated 2026-09-22):**
1. One shared table-row editor engine for ALL 3 nouns (no separate paragraph engine). Web = parameterize `AdminRowEditor` by kind; app = reuse app's row-engine.
2. Homepage title/body stays a PLAIN form in Content tab (web) / app keeps its daily/service content block; 3 windowed editors render BELOW/after it. Settings ? Company info ONLY in both.

**Files (web):** create `components/admin/AdminRowEditor.tsx` (windowed, kind-parameterized); rewrite `components/admin/AdminContent.tsx` (homepage plain form + 3� AdminRowEditor below); shrink `components/admin/AdminSettings.tsx` to Company-only (remove programs/pilots/curricula blocks). Keep `/api/admin/settings` + `/api/admin/content` routes unchanged (no server change, no edge fn deploy, no schema change, no PAT).

**Files (app):** `mobile/src/screens/AdminScreen.tsx` Content tab + reuse app row-engine; add same 3 windowed editors under app Content tab; app Settings keeps Company-only. No new services needed (reuse programsService/adminService).

**Verification + parity (must stay green):** web `tsc --noEmit` + lint + vitest; app `tsc --noEmit` + vitest; then the **staff-access E2E (staff-access-e2e.mjs web + app staff-access-e2e)** must still pass 25/25 � especially the staff-delete-403 assertions (proves canDelete gate survived the move). Push BOTH repos. THIS is the non-negotiable gate.

**Secrets:** ZERO new secrets this phase. Do NOT touch the revoked PAT. Never print/commit tokens.

**Known traps:** PowerShell needs `-Raw`+regex or script files for pattern work (inline quotes break); basename casing `TRACKS\INDEX.md`; edge fn deploy ref `bkylfnlybtsujwzru` (already deployed, don't redeploy). Web repo root = E:\GENUM SOLUTIONS PVT LTD\Project\genumsolutions-website; app = ...\genumsolutions-app. Working dirs must be set via them; use npx supabase only if a future deploy is genuinely needed (NOT this phase).

*Next session: read this BEFORE note fully, then apply the implementation + verification checklist above. Ledger row for Phase C itself is separate (U-12 below / after).*

### BEFORE-session handoff � Phase C (web first-half) � WRITTEN 2026-09-22, pre-implementation

**Cold-session orientation (read this before any edit):**
Phase C = extract the 3 content-shaped sub-forms OUT of the web *Settings* tab and below the *Content* tab's plain homepage form, using **ONE parameterized windowed row-editor engine**, then shrink Settings to **Company-only**. App-side parity (mobile Content tab + settings) is the SECOND half of this phase � a separate session.

**Files � the surgical map ended up CLEANER than the audit predicted:**
- `components/admin/AdminSettings.tsx` (258 lines, client component) is the **engine owner**: Company form + the 3 sub-forms (Training programs / Pilot cost lines / Curriculum highlights), each a windowed row editor with `refresh(kind)` fetch + `canDelete` gate (staff sees Edit/Preview only, NO delete � Phase B parity that must survive).
- `components/admin/AdminContent.tsx` (69 lines, client) is the **homepage plain form** only (homepage title/body). This is where the 3 windowed engines get MOUNTED (below the plain form).
- Engine to REUSE one-to-one: the `refresh('training'|'pilot'|'curriculum')` + noun-state setter + `saveX`/`removeX` trio, all already present in `AdminSettings.tsx`. **Do NOT invent a second engine.**

**The 3 locked owner decisions (do not re-litigate):**
1. ONE row-editor engine, parameterized by `kind` (`training|pilot|curriculum`) � NOT 3 bespoke editors.
2. Homepage form STAYS a plain form (mount the 3 windowed engines BELOW it in Content).
3. Settings tab ? Company info ONLY, both clients.

**RBAC contract (Phase B gate � deletions gated by `canDelete` prop; staff sees view/edit only).** In AdminSettings today `canDelete` is threaded through each `removeX`; the move must preserve the exact `canDelete ? Delete : (nothing)` rendering so staff-parity can't regress. After the move, re-run the staff-access E2E (25/25) on BOTH clients.

**Status at write time:** website repo clean at `b59eec1`, `main` pushed & synced. Edge functions `admin-set-role` + `admin-delete-user` ACTIVE live (Phase B done). Secrets: `SUPABASE_ACCESS_TOKEN` REVOKED (PAT deleted 2026-09-22), `.env.local` clean of it; app repo (`genumsolutions-app`) clean at `b8a87bf`. Phase B E2E: web 25/25 + app 25/25 green. Phase C = PURE client-side split (no new edge fns, no schema, no PAT needed) both clients.

**Verification gate before push (both halves):** `npx tsc --noEmit` green + vitest green + the 3 editors save/delete clean + staff-access E2E 25/25. Then update THIS rows status from BEFORE ? DONE with the after-note. Never print or commit tokens.

*Grep gotcha: path is `TRACKS\INDEX.md` (not TRACKS\\INDEX.md), PowerShell needs -Raw for replace or script file for inline regex; never echo token values.*
