-- Connections-Hub round (2026-09-28): per-user per-car profiles.
-- Mirrors robot_user_settings but keyed by the car's STABLE profile key
-- (`fw:<boardId>` | BT MAC | `wifi:<ssid>`, see mobile/src/services/
-- carProfileService.ts). Holds mode/speed/steer/trim, saved-router + BT-id
-- sets, wifi_history (names only), auto_join_router. Passwords never stored.
create table if not exists public.car_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_key text not null,
  car_name text not null default '',
  unique_id text not null default '',
  settings jsonb not null default '{}'::jsonb,
  wifi_history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, profile_key)
);

create index if not exists car_profiles_user_idx on public.car_profiles (user_id);
create index if not exists car_profiles_profile_idx on public.car_profiles (profile_key);
create index if not exists car_profiles_unique_id_idx on public.car_profiles (unique_id);

create or replace function public.touch_car_profiles()
returns trigger set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists car_profiles_touch on public.car_profiles;
create trigger car_profiles_touch
before update on public.car_profiles
for each row execute function public.touch_car_profiles();

alter table public.car_profiles enable row level security;

drop policy if exists "car_profiles_select_own" on public.car_profiles;
create policy "car_profiles_select_own" on public.car_profiles
for select using (
  auth.uid() = user_id
  or public.is_staff()
);

drop policy if exists "car_profiles_insert_own" on public.car_profiles;
create policy "car_profiles_insert_own" on public.car_profiles
for insert with check (auth.uid() = user_id);

drop policy if exists "car_profiles_update_own" on public.car_profiles;
create policy "car_profiles_update_own" on public.car_profiles
for update using (
  auth.uid() = user_id
  or public.is_staff()
);

drop policy if exists "car_profiles_delete_own" on public.car_profiles;
create policy "car_profiles_delete_own" on public.car_profiles
for delete using (
  auth.uid() = user_id
  or public.is_admin()
);