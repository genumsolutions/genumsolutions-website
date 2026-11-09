-- =====================================================================
-- 20261108_user_logs_profiles.sql
-- New user-centric audit + profile-entry tables for the admin panels and
-- the app transport layer to audit per-user robot profiles and activity.
--
-- Designed to be applied AFTER the existing tables (profiles, car_profiles,
-- activity_log, device_crash_reports, app_logs, robot_user_settings) and
-- to coexist with them. Nothing here touches the existing tables.
--
-- Idempotent: safe to re-run in the Supabase SQL Editor.
-- RLS: enabled on all three tables; the admin routes read/write them with the
-- service-role key (which bypasses RLS), while signed-in users may only touch
-- their own rows.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------

-- Per-user log. Mirrors activity_log vocabulary (action/entity_type/entity_id
-- /details) but is owned by the app user and scoped for per-user inspection
-- at the API level. Service-role only via the new admin routes.
create table if not exists public.user_activity_log (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null default '',
  entity_type text not null default '',
  entity_id uuid,
  details jsonb not null default '{}',
  created_at timestamptz not null default now(),
  primary key (id)
);

-- Per-user profile entries. A flexible key/value list attached to a user so
-- the admin panel and app can surface each car/project profile inside that
-- user's profile without extending the core profiles table. The entry type
-- is drawn from profile_entry_types so the UI can label each entry group
-- (car profile / project profile / other).
create table if not exists public.profile_entry_types (
  id uuid not null default gen_random_uuid(),
  name text not null default '',
  description text not null default '',
  created_at timestamptz not null default now(),
  primary key (id)
);

-- Seed a default type so the UI has something reasonable before any admin
-- creates custom types.
insert into public.profile_entry_types (id, name, description)
values ('00000000-0000-0000-0000-000000000001', 'car profile', 'A robot car profile saved under this user.')
on conflict (id) do nothing;

create table if not exists public.user_profile_entries (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type_id uuid not null references public.profile_entry_types(id) on delete restrict,
  title text not null default '',
  body jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (id)
);

-- ---------------------------------------------------------------------
-- Foreign keys for tables created before the inline constraints existed.
-- The create-table statements above already declare these inline, so each
-- block here is a no-op on a fresh apply and only fills a real gap on an
-- older/partial table. Never re-adds an existing constraint.
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'user_activity_log_user_id_fkey'
      and conrelid = 'public.user_activity_log'::regclass
  ) then
    alter table public.user_activity_log
      add constraint user_activity_log_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'user_profile_entries_user_id_fkey'
      and conrelid = 'public.user_profile_entries'::regclass
  ) then
    alter table public.user_profile_entries
      add constraint user_profile_entries_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'user_profile_entries_type_id_fkey'
      and conrelid = 'public.user_profile_entries'::regclass
  ) then
    alter table public.user_profile_entries
      add constraint user_profile_entries_type_id_fkey
      foreign key (type_id) references public.profile_entry_types(id) on delete restrict;
  end if;
end
$$;

-- ---------------------------------------------------------------------
-- Indexes for the per-user lists and the admin ordering.
-- ---------------------------------------------------------------------
create index if not exists user_activity_log_user_id_idx
  on public.user_activity_log (user_id);
create index if not exists user_activity_log_created_at_idx
  on public.user_activity_log (created_at desc);
create index if not exists user_profile_entries_user_id_idx
  on public.user_profile_entries (user_id);
create index if not exists user_profile_entries_type_id_idx
  on public.user_profile_entries (type_id);
create index if not exists user_profile_entries_created_at_idx
  on public.user_profile_entries (created_at desc);

-- ---------------------------------------------------------------------
-- RLS. Enabled, not bypassed.
--   * service_role bypasses RLS, which is how the admin routes read/delete.
--   * signed-in users may read and insert only their own log rows / entries.
--   * profile_entry_types is readable to signed-in users so the app can label
--     entries; only the service role writes types.
-- ---------------------------------------------------------------------
alter table public.user_activity_log enable row level security;
alter table public.profile_entry_types enable row level security;
alter table public.user_profile_entries enable row level security;

drop policy if exists "user_activity_log_select_own" on public.user_activity_log;
create policy "user_activity_log_select_own" on public.user_activity_log
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "user_activity_log_insert_own" on public.user_activity_log;
create policy "user_activity_log_insert_own" on public.user_activity_log
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "profile_entry_types_select_authenticated" on public.profile_entry_types;
create policy "profile_entry_types_select_authenticated" on public.profile_entry_types
  for select to authenticated
  using (true);

drop policy if exists "user_profile_entries_select_own" on public.user_profile_entries;
create policy "user_profile_entries_select_own" on public.user_profile_entries
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "user_profile_entries_insert_own" on public.user_profile_entries;
create policy "user_profile_entries_insert_own" on public.user_profile_entries
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "user_profile_entries_update_own" on public.user_profile_entries;
create policy "user_profile_entries_update_own" on public.user_profile_entries
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Staff/admin access. The website admin routes read with the service-role
-- key (which bypasses RLS), but the mobile app reads with the signed-in
-- session, so it needs explicit staff read + admin delete policies. This
-- mirrors the "staff read X" / "admin delete X" convention used by
-- activity_log, device_crash_reports and app_logs.
-- (Applied to the live project by 20261109_user_logs_staff_rls.sql.)
drop policy if exists "staff read user activity log" on public.user_activity_log;
create policy "staff read user activity log" on public.user_activity_log
  for select to authenticated
  using (public.is_staff());

drop policy if exists "admin delete user activity log" on public.user_activity_log;
create policy "admin delete user activity log" on public.user_activity_log
  for delete to authenticated
  using (public.is_admin());

drop policy if exists "staff read user profile entries" on public.user_profile_entries;
create policy "staff read user profile entries" on public.user_profile_entries
  for select to authenticated
  using (public.is_staff());

drop policy if exists "admin delete user profile entries" on public.user_profile_entries;
create policy "admin delete user profile entries" on public.user_profile_entries
  for delete to authenticated
  using (public.is_admin());

comment on table public.user_activity_log is
  'Per-user audit log written by the app; read/delete by admins through the service role.';
comment on table public.profile_entry_types is
  'Labels for per-user profile entry groups (seeded with car profile).';
comment on table public.user_profile_entries is
  'Per-user car/project profile entries shown in the admin profile entries panel.';
