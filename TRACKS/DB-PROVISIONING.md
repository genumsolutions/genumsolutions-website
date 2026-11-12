# Database provisioning & drift runbook — live project `jxgmbodzkmxanuwfaqxo`

Use this when the deployed Supabase database and `supabase/schema.sql` disagree: a fresh/moved
project, a partially applied migration, or any bug that smells like "the table/column isn't there".

`supabase/schema.sql` is the canonical, idempotent definition of the whole public schema (39 tables,
RLS policies, storage bucket, guard functions + triggers). Re-running it is safe by design:
`create table if not exists`, `create or replace function`, `drop policy if exists` before
`create policy`, `add column if not exists`.

---

## 1. Symptoms of drift (all seen 2026-11-12)

| Symptom                                                                             | Cause                                                                                                                                                       |
| ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Admin/staff account sees only the customer UI; no Admin button in app or website    | `profiles.tier` missing → the combined `select(... role, tier ...)` failed as a whole → every profile read returned `null` and role fell back to `customer` |
| Signed-in user is shown the "create account" form                                   | same failed profile read                                                                                                                                    |
| "No account found for that Google address" never reached / any 404 on customer data | tables from `schema.sql` absent (live DB had 6 of 39)                                                                                                       |
| `PGRST205` / `42703` in Vercel or edge-function logs                                | table or column not in PostgREST's schema cache                                                                                                             |

The code has since been made tolerant of a missing optional `tier` (`getProfile()` and
`genumUserFromSession()` retry without it), but that only protects `tier` — **any other missing
column or table is still fatal**, so check the database rather than trusting the UI.

---

## 2. Check for drift

```bash
cd genumsolutions-website
npm run db:drift            # exits 1 on any drift
npm run db:drift -- --verbose
```

The check parses `supabase/schema.sql` and runs in two passes:

1. **Tables + columns** (PostgREST, no DB password). Probes every expected column: `404/PGRST205` →
   missing table, `400/42703|PGRST204` → missing column, `401/403/42501` → table exists but the key
   cannot read it (reported, not failed).
2. **RLS, policies and guard triggers** (Management API SQL, when `SUPABASE_ACCESS_TOKEN` or
   `SUPABASE_MANAGEMENT_TOKEN` is set). Verifies every table schema.sql enables RLS on still has it,
   every public policy exists, and every user trigger exists — including `protect_owner_account` /
   `block_new_google_account` on `auth.users` and `profiles_protect_role` / `profiles_protect_tier`.
   Without an access token this pass is skipped with a note (the table/column result still holds).

It uses `SUPABASE_SERVICE_ROLE_KEY` when present (preferred — RLS and grants cannot hide a table),
otherwise the anon key, both from `.env.local`. It is deliberately **not** part of `test:ci`: the
suite stays offline, and this needs a deployed project. Run it after every provisioning pass, after a
project move, and after adding anything to `schema.sql`.

---

## 3. Apply `schema.sql`

### Path A — direct Postgres (preferred)

```bash
npm run db:apply          # whole file in one transaction
npm run db:apply:seed     # …and re-seed products / journal / programs / company
```

Needs `SUPABASE_DB_URL` in `.env.local` (Dashboard → Database → Connect → "postgres" pooler URL).
`scripts/apply-schema.ts` runs `set role postgres` first: on a PgBouncer connection
`current_setting('role')` is `none`, which makes `protect_role_column` / `protect_tier_column` reject
the owner upsert. Any statement failure rolls the entire file back.

### Path B — Management API (when there is no DB password)

`SUPABASE_DB_URL` is often absent (it was on 2026-11-12), and the `pg_net`-style `/sql` endpoint from
`scripts/apply-migration-via-api.sh` 404s on this project. What works is the **query** endpoint:

```
POST https://api.supabase.com/v1/projects/jxgmbodzkmxanuwfaqxo/database/query
Authorization: Bearer $SUPABASE_ACCESS_TOKEN
Content-Type: application/json
{ "query": "<ONE statement>" }
```

Rules learned the hard way:

1. **One statement per request.** Multi-statement bodies are rejected (`413`/parse error), so split
   `schema.sql` yourself.
2. **Split correctly**: track `$$ … $$` function bodies, `--` line comments, `/* */` blocks, and
   single/double-quoted strings. A naive `split(';')` cuts every `plpgsql` function in half and
   produces dozens of syntax errors that look like schema bugs.
3. **Pace it.** A free-plan project throttles after roughly 120 rapid requests
   (`429 ThrottlerException`). Sleep ~650 ms between statements and back off on 429.
   `201` = applied.
4. **Resume, don't restart.** Keep the statement index; a throttled run had applied 117 of 606 and
   resumed at 118. Re-running from zero just burns the rate limit again (it is idempotent, so it is
   safe, only slow).
5. Verify with the same endpoint afterwards (counts, `pg_proc`/`pg_trigger`) — not with the client.

### Path C — Dashboard SQL editor

Paste the file. Fine for one-off migrations, painful for the full schema, no throttling.

---

## 4. Verify a provisioning pass

```bash
npm run db:drift          # must print "OK: all 39 tables present with every schema.sql column"
```

Then, through the Management API (Path B) or SQL editor:

```sql
-- tables / RLS coverage: expect 39 and 38
select count(*) from pg_tables where schemaname = 'public';
select count(*) from pg_tables p
 where p.schemaname = 'public' and exists (
   select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = p.tablename and c.relrowsecurity);

-- guard triggers must exist on the LIVE database
select tgname, tgrelid::regclass::text as on_table
  from pg_trigger where tgname in ('profiles_protect_role', 'profiles_protect_tier',
                                   'protect_owner_account')
   and not tgisinternal;

-- and confirm the retired Google guard is GONE
select count(*) from pg_trigger where tgname = 'block_new_google_account';
```

Behavioural checks (the ones that actually caught the bug):

- owner account delete → `BLOCKED: The owner account cannot be deleted.`, `auth.users` count unchanged
- brand-new Google identity → account is created and signed in (Google is a registration path);
  the row must still exist afterwards, never created-then-deleted
- anon `GET /rest/v1/profiles` → `[]` (RLS on, no policy for anon)
- admin JWT → sees all profiles; customer JWT → only their own

---

## 5. What `schema.sql` guarantees once applied

- `profiles.role` + `profiles.tier` with `protect_role_column()` / `protect_tier_column()` — only
  admins (service role / `postgres`) can change either; a user cannot self-promote.
- `protect_owner_account` `BEFORE DELETE` on `auth.users` — the owner row can never be deleted, from
  any client or edge function.
- **No `block_new_google_account` trigger.** It was removed on 2026-11-12 because it refused every
  brand-new Google row, which broke Google registration. `schema.sql` keeps the `drop trigger` /
  `drop function` statements so an old database converges — do **not** re-add the guard.
- RLS on 38 of 39 tables with the canonical `is_staff()` / `is_admin()` policies.
- The `product-images` storage bucket + its policies.
- `public.is_admin()` / `public.is_staff()` helpers — every policy depends on them, so if those are
  missing, RLS policies silently deny everything.

## 6. Not covered by `schema.sql`

- **Edge functions.** They are deployed separately (`npx supabase functions deploy <name> --project-ref <ref> --yes`)
  and each has its own secrets. Check the registry in `TRACKS/INDEX.md`; a schema pass does not deploy them.
- **`app-releases` storage bucket** (APK + `release.json` for `/app` and the OTA manifest). Created by
  hand on project moves — see the 2026-11-07 note in `TRACKS/INDEX.md`.
- **Auth settings** (`mailer_autoconfirm`, `external_google_enabled`, signup flags) — Dashboard or
  Management API, not SQL.
- **Seed content.** `schema.sql` creates empty tables; `npm run db:apply:seed` (or `npm run seed:*`)
  fills canonical rows. A table that exists with the wrong row count is a seed problem, not drift.
- **The `pg_net` order-status push trigger** (`supabase/order-status-push-trigger.sql`) — needs the
  anon key substitution documented in that file.
- **Storage-object policies.** The RLS/policy pass covers `pg_policies` in `public`; the
  `product-images` bucket policies live on `storage.objects` and are not verified by the drift check.

---

## 2026-11-12 — full re-provision + guards (record)

After the 2026-11-07 project move, only 6 of 39 tables existed and `profiles.tier` was absent, which
is what hid staff/admin access. Applied the full `schema.sql` via Path B: **489 statements applied,
0 failures** (after resuming past a 429 window), live database now at **39 tables**, `profiles` 3
rows, `products` 17, `categories` 11, `services` 6. Added `protect_owner_account` to `schema.sql`
in the same pass so a future re-provision keeps it. (`block_new_google_account` was added in that
same pass and removed later the same day — see `TRACKS/AUTH-REGISTRATION.md`; its drops remain.)
`npm run db:drift` was written here and validated in both directions against
`information_schema.columns` (39/39 tables, 0 columns unparsed) and against deliberately broken
selects (missing column → `42703`, missing table → `PGRST205`). It was later extended to verify RLS,
public policies and guard triggers via the Management API when an access token is present (38 RLS
tables, 141 policies, 15 triggers against the live project).
