-- Verify the logs/profiles migration landed on the live genumsolutions
-- project (jxgmbodzkmxanuwfaqxo). Run this in the Supabase Dashboard SQL
-- Editor AFTER applying supabase/migrations/20261108_user_logs_profiles.sql
-- (or the same three-table section appended in supabase/schema.sql).
--
-- Tables must exist but can be empty. Also confirm the public read policies
-- exist so AdminUserLogs and AdminProfileEntries can read them.
-- This script is for the SQL Editor, not for the repo's JS probes.

-- 1) Confirm the three admin tables exist.
select table_name, table_type
  from information_schema.tables
  where table_schema = 'public'
    and table_name in ('user_activity_log','user_profile_entries','profile_entry_types')
  order by table_name;

-- 2) Confirm the columns on each table.
select table_name, column_name, data_type, is_nullable, column_default
  from information_schema.columns
  where table_schema = 'public'
    and table_name in ('user_activity_log','user_profile_entries','profile_entry_types')
  order by table_name, ordinal_position;

-- 3) Confirm the seeded profile-entry type, if any.
select id, name, description, created_at
  from public.profile_entry_types
  order by name nulls last, id;

-- 4) Confirm keys/constraints so the UI's FK usage is sound.
select tc.table_name, kcu.column_name, ccu.table_name as references_table, ccu.column_name as references_column
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu
    on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema
  join information_schema.constraint_column_usage ccu
    on ccu.constraint_name = tc.constraint_name and ccu.table_schema = tc.table_schema
  where tc.table_schema = 'public'
    and tc.constraint_type = 'FOREIGN KEY'
    and tc.table_name in ('user_activity_log','user_profile_entries')
  order by tc.table_name, kcu.column_name;

-- 5) Confirm sample rows, if any exist yet (empty is fine before seed).
select id, user_id, action, entity_type, entity_id, left(details::text, 120) as details_sample, created_at
  from public.user_activity_log
  order by created_at desc nulls last, id
  limit 20;

select id, user_id, type_id, title, left(body::text, 120) as body_sample, created_at, updated_at
  from public.user_profile_entries
  order by created_at desc nulls last, id
  limit 20;

-- 6) Admin read access checks. The admin routes use the service-role
--    client, so these are the exact table access patterns the routes exercise.
--    Empty counts are fine before seeding.
select 'admin_read_user_activity_log' as probe, count(*)::int as row_count
  from public.user_activity_log;

select 'admin_read_user_profile_entries' as probe, count(*)::int as row_count
  from public.user_profile_entries;

select 'admin_read_profile_entry_types' as probe, count(*)::int as row_count
  from public.profile_entry_types;

-- 7) Confirm RLS is enabled on all three tables.
select c.relname as table_name, c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in ('user_activity_log','user_profile_entries','profile_entry_types')
  order by c.relname;

-- 8) Confirm the policies the migration creates. The admin panels read through
--    the service-role key (which bypasses RLS), so these policies govern the
--    signed-in app users, not the admin routes.
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
  from pg_catalog.pg_policies
  where schemaname = 'public'
    and tablename in ('user_activity_log','user_profile_entries','profile_entry_types')
  order by tablename, policyname;
