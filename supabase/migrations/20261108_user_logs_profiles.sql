-- =====================================================================
-- 20261108_user_logs_profiles.sql
-- New user-centric audit + profile-entry tables for the admin panels and
-- the app transport layer to audit per-user robot profiles and activity.
--
-- Designed to be applied AFTER the existing tables (profiles, car_profiles,
-- activity_log, device_crash_reports, app_logs, robot_user_settings) and
-- to coexist with them. Nothing here touches the existing tables.
-- =====================================================================

-- Per-user log. Mirrors activity_log vocabulary (action/entity_type/entity_id
-- /details) but is owned by the app user and scoped for per-user inspection
-- at the API level. Service-role only via the new admin routes.
create table if not exists user_activity_log (
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
create table if not exists profile_entry_types (
  id uuid not null default gen_random_uuid(),
  name text not null default '',
  description text not null default '',
  created_at timestamptz not null default now(),
  primary key (id)
);

-- Seed a default type so the UI has something reasonable before any admin
-- creates custom types.
insert into profile_entry_types (id, name, description)
values ('00000000-0000-0000-0000-000000000001', 'car profile', 'A robot car profile saved under this user.')
on conflict (id) do nothing;

create table if not exists user_profile_entries (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type_id uuid not null references profile_entry_types(id) on delete restrict,
  title text not null default '',
  body jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (id)
);

-- Keep the per-user lists bounded and orderly.
alter table user_activity_log add constraint user_activity_log_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;
alter table user_profile_entries add constraint user_profile_entries_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;
alter table user_profile_entries add constraint user_profile_entries_type_id_fkey
  foreign key (type_id) references profile_entry_types(id) on delete restrict;

-- Service-role-only admin deletes are performed through the new API routes.
-- The tables themselves remain readable/writable by the service role from
-- those routes; no blanket open policy is added here.
