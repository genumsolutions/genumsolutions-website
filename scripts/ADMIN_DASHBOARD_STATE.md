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
- The Supabase project host itself does not expose those routes: `https://jxgmbodzkmxanuwfaqxo.supabase.co/api/admin/*` returns `404` with empty body. That is expected; the admin routes live on the Vercel deployment, not on the Supabase project host.## Migration applied live (2026-11-09)
- `supabase/migrations/20261108_user_logs_profiles.sql` was applied in the Supabase Dashboard SQL Editor and succeeded.
- The earlier `ERROR: 42710: constraint "user_activity_log_user_id_fkey" already exists` was a bug in the migration, not in the DB: the create-table statements already declared the foreign keys inline, then re-added the same constraints by name. The whole file rolled back in the SQL Editor transaction, which is why the tables reported as missing afterwards. Fixed by guarding each FK add with a `pg_constraint` existence check; the migration is now safe to re-run.
- RLS is enabled on all three tables with six policies:
  - `user_activity_log`: `user_activity_log_select_own`, `user_activity_log_insert_own`
  - `user_profile_entries`: `user_profile_entries_select_own`, `user_profile_entries_insert_own`, `user_profile_entries_update_own`
  - `profile_entry_types`: `profile_entry_types_select_authenticated`
    The admin routes are unaffected — they use the service-role key, which bypasses RLS.

### Verified live via PostgREST with the service-role key

- `GET /rest/v1/user_activity_log` → HTTP 200, `[]`
- `GET /rest/v1/profile_entry_types` → HTTP 200, returns the seeded row `00000000-0000-0000-0000-000000000001` (`car profile`)
- `GET /rest/v1/user_profile_entries` → HTTP 200, `[]`
- Joined read `user_profile_entries?select=*,profile_entry_types(name)` → HTTP 200 and resolves `profile_entry_types.name`, which is what `listUserProfileEntries` maps to `typeName`.
- Insert → read → delete round trip on both `user_activity_log` and `user_profile_entries` succeeded (HTTP 200 each), and both tables were left empty again afterwards.

## Still to confirm

- The admin UI itself has not been exercised with a signed-in admin session from here. The published endpoints are live and gated (`401 {"error":"Unauthorized"}` without a session), and the underlying data path is verified, so what remains is a click-through in the live admin: `/admin` → **User Logs** and **Profile Entries**.

## Duplicate/redundant cleanup already applied

- Removed stale inline-token fallbacks from the probe scripts.
- Removed duplication between the old `admin-api-probe.ts` and the shell wrapper's inline probe.
- Removed duplicate “verify” sections that previously existed in more than one helper.
- Narrowed `admin-api-probe.ts` / `.sh` to the paths that matter for this task.
- Aligned `admin-types.ts` types with the actual route/lib payloads.
