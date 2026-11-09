# Admin dashboard parity state

## What is done

- Admin shell: `components/AdminPanel.tsx` renders all admin tabs including **User Logs** and **Profile Entries**.
- Admin tabs: `components/admin/AdminUserLogs.tsx` and `components/admin/AdminProfileEntries.tsx` are wired to the real server routes and support paginated reads and admin-only deletes.
- Routes:
  - `app/api/admin/user-logs/route.ts` — `GET` + `DELETE`, guarded by `isAdminRequest()`
  - `app/api/admin/profile-entries/route.ts` — `GET` + `DELETE`, guarded by `isAdminRequest()`
  - `app/api/admin/logs/route.ts` — existing system logs route; it delegates `kind=user` reads and `table=user_activity_log` deletes to the same `lib/user-logs` helpers
- Service layer: `lib/user-logs.ts` implements paginated reads and deletes for
  - `user_activity_log`
  - `user_profile_entries`
  - `profile_entry_types`
    using the server-only service-role client.

## What is clean now

- `scripts/admin-api-probe.ts` and `scripts/admin-api-probe.sh` are the single consistent probe surface for the published admin APIs. They read credentials from the environment and do not hardcode real keys.
- `scripts/verify-logs-profiles.sql` is the canonical DB verification artifact for the three new tables.
- `scripts/apply-migration-via-api.sh`, `scripts/apply-migration-via-db-host.sh`, and `scripts/verify-migration-via-api.sh` now state clearly that they are NOT usable from this environment and point to the usable paths.
- `genumsolutions-website/.env.local` has the latest credentials the user supplied and is syntactically valid for `set -a; . ./.env.local`.

## Verified live

- `SUPABASE_ACCESS_TOKEN` is live: management API `GET /v1/projects/jxgmbodzkmxanuwfaqxo` returns HTTP 200.
- The published site `https://genumsolutions-website.vercel.app/api/admin/*` is live and gated:
  - Every admin endpoint returns `401 { "error": "Unauthorized" }` when probed without an admin session.
  - That includes `/api/admin/user-logs`, `/api/admin/profile-entries`, `/api/admin/logs`, `/api/admin/content`, `/api/admin/users`, `/api/admin/orders`, `/api/admin/products`, `/api/admin/activity`, `/api/admin/analytics`, `/api/admin/messages`, `/api/admin/settings`, `/api/admin/car-modes`, `/api/admin/car-profiles`.
- The Supabase project host itself does not expose those routes: `https://jxgmbodzkmxanuwfaqxo.supabase.co/api/admin/*` returns `404` with empty body. That is expected; the admin routes live on the Vercel deployment, not on the Supabase project host.

## Not verified from here yet

- The three tables `user_activity_log`, `user_profile_entries`, `profile_entry_types` have not been confirmed on the live DB from here, because the migration has not been applied from here.
- Admin-deletable behavior with real rows has not been confirmed end to end from here, because the migration is not applied here, there is no admin session available for the live site probes, no `SUPABASE_DB_URL` is in `.env.local`, and the only SQL-proxy paths reachable from here are blocked.

## Remaining blocker

The migration `supabase/migrations/20261108_user_logs_profiles.sql` (and the same three-table section appended in `supabase/schema.sql`) still needs to be applied to the live project through one of these usable paths:

- Supabase Dashboard SQL Editor
- `npm run db:apply` once `SUPABASE_DB_URL` is added to `.env.local`
- A CI run with direct DB credentials

After the migration is applied, run `scripts/verify-logs-profiles.sql` in the Dashboard SQL Editor and confirm:

- the three tables exist,
- the columns/foreign keys match,
- the seeded `profile_entry_types` row `00000000-0000-0000-0000-000000000001` exists.

## Duplicate/redundant cleanup already applied

- Removed stale inline-token fallbacks from the probe scripts.
- Removed duplication between the old `admin-api-probe.ts` and the shell wrapper's inline probe.
- Removed duplicate “verify” sections that previously existed in more than one helper.
- Narrowed `admin-api-probe.ts` / `.sh` to the paths that matter for this task.
- Aligned `admin-types.ts` types with the actual route/lib payloads.
