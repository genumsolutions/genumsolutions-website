# genumsolutions-website TRACKS — FAILSAFE 2026-09-18

Do-not-break invariants + recovery during the app·website sync effort. Master plan:
`guide/APP-WEBSITE-SYNC-PLAN-2026-09-18.md`.

## Invariants

- **Never force-push.** `main` reconciles via `git pull --ff-only` only.
- **Never print or commit secrets.** `.env.local` stays gitignored; only malformed/stray
  lines + dead Stripe placeholders are edited, never live keys.
- **The fallback must always reflect the LAST RELEASED build** — never a version in
  advance of an uploaded APK. `sync-app-fallback.mjs` only reads the live manifest.
- **`scripts/sync-app-fallback.mjs` must be idempotent** after A2 — two consecutive runs
  produce identical `lib/company.ts`.
- **No auto-commit of a corrupt file.** After A3, `sync-app-fallback.yml` gates its commit
  on `tsc --noEmit` passing; otherwise it restores the file and fails.
- **Vercel deploys on every `main` push** — a broken commit ships. All changes must pass
  `typecheck` before commit.

## Recovery

| Symptom | Action |
|---|---|
| `lib/company.ts` re-corrupted between pull and push | Re-run A2 (+A3) then A1 clean-up before pushing; the fix commit supersedes the bot commit. |
| Typecheck still red at 5 errors on `company.ts` | Restore pre-corruption shape from `350ca9e^`/`ccea8dd`; `git diff` to confirm only `androidApp` fields changed. |
| Pull refused (divergence) | STOP; report divergence in ledger, don't merge blindly. |
| Manifest fetch fails during sync script | Script already exits 1 without touching the file (network guard). Safe. |
| `.env.local` edits break a flow | Only removed: malformed line + `STRIPE_*` placeholders. Re-add from `.env.example`. |
| Cron fired mid-effort | Sync script is now idempotent (A2) — worst case a no-op. |