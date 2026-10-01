-- Device registry + per-unit naming + user profile enrichment
-- Owner decision 2026-10-01: model metadata is canonical in the repo
-- (guide/DEVICE-REGISTRY.json); each PHYSICAL UNIT's display name lives in
-- this database. Advertised BT/AP names are FROZEN hardware identity and are
-- recorded as read-only facts, never regenerated.
--
-- Why user_devices is a separate table rather than a name column on devices:
-- car_profiles is keyed by (user_id, profile_key), so today two users can hold
-- conflicting names for the SAME physical car. devices is the shared truth;
-- user_devices holds each owner's own name for it.
--
-- Everything here is ADDITIVE and idempotent. No existing table is dropped,
-- renamed or have a column removed.

-- ---------------------------------------------------------------------
-- 1. device_models - the canonical model catalogue (6 fleet models).
--    Public read so the website and the app's anon key can both use it,
--    staff-only write, exactly like robo_car_modes.
-- ---------------------------------------------------------------------
create table if not exists public.device_models (
  id text primary key,
  display_name text not null,
  repo text not null default '',
  fw_name text not null default '',
  fw_version text not null default '',
  -- FROZEN advertised identity. Recorded for the pairing screen so the user
  -- can match what Bluetooth announces; never used to RE-ADVERTISE a name.
  bt_name text,
  ap_ssid text,
  ap_ip text,
  ap_subnet text,
  transports jsonb not null default '[]'::jsonb,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.device_models enable row level security;

drop policy if exists "public read device_models" on public.device_models;
create policy "public read device_models"
  on public.device_models for select using (true);
drop policy if exists "staff insert device_models" on public.device_models;
create policy "staff insert device_models"
  on public.device_models for insert with check (public.is_staff());
drop policy if exists "staff update device_models" on public.device_models;
create policy "staff update device_models"
  on public.device_models for update using (public.is_staff());
drop policy if exists "admin delete device_models" on public.device_models;
create policy "admin delete device_models"
  on public.device_models for delete using (public.is_admin());

create index if not exists device_models_sort_idx
  on public.device_models (sort_order, display_name);

-- ---------------------------------------------------------------------
-- 2. devices - ONE physical unit, shared across every user.
--    unique_id reuses the app's EXISTING resolution rule
--    (mobile/src/services/carProfileService.ts resolveProfileKey):
--      fw:<boardId>  - firmware ESP.getEfuseMac() last 6 hex, preferred
--      <bt-mac>       - bare Bluetooth MAC
--      wifi:<ssid>    - WiFi-only legacy fallback
--    It is NOT a foreign key to anything: it is the same string the app
--    already persists as car_profiles.profile_key, so a car the user has
--    driven today is immediately resolvable to a device row.
-- ---------------------------------------------------------------------
create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  unique_id text not null unique,
  model_id text references public.device_models(id) on delete set null,
  -- What the unit last REPORTED, not what we assume.
  fw_version text not null default '',
  -- Owner-assigned label for the unit itself, shown when there is exactly one
  -- owner. user_devices.display_name wins whenever it is set.
  nickname text not null default '',
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS and policies for devices are created in section 3b, AFTER user_devices
-- exists: the "owner read devices" policy references user_devices, and Postgres
-- validates a policy body the moment it is created, so a table referenced by
-- a policy must already exist.
create index if not exists devices_model_idx on public.devices (model_id);
create index if not exists devices_last_seen_idx
  on public.devices (last_seen_at desc nulls last);

-- ---------------------------------------------------------------------
-- 3. user_devices - the per-user, per-unit name. This is the table that
--    fixes "two users, one car, two different names".
-- ---------------------------------------------------------------------
create table if not exists public.user_devices (
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid not null references public.devices(id) on delete cascade,
  display_name text not null default '',
  is_favourite boolean not null default false,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, device_id)
);

create index if not exists user_devices_device_idx
  on public.user_devices (device_id);

-- ---------------------------------------------------------------------
-- 3b. RLS for devices + user_devices.
--     Deliberately after BOTH tables exist: "owner read devices" queries
--     user_devices, and Postgres compiles a policy body at CREATE time, so
--     creating that policy before user_devices exists fails the migration.
--     Both statements are also additive/idempotent, so re-running is safe.
-- ---------------------------------------------------------------------
alter table public.devices enable row level security;
alter table public.user_devices enable row level security;

drop policy if exists "owner read devices" on public.devices;
create policy "owner read devices"
  on public.devices for select using (
    public.is_staff()
    or exists (
      select 1 from public.user_devices ud
      where ud.device_id = devices.id and ud.user_id = auth.uid()
    )
  );
drop policy if exists "owner insert devices" on public.devices;
create policy "owner insert devices"
  on public.devices for insert with check (public.is_staff());
drop policy if exists "staff update devices" on public.devices;
create policy "staff update devices"
  on public.devices for update using (public.is_staff());
drop policy if exists "admin delete devices" on public.devices;
create policy "admin delete devices"
  on public.devices for delete using (public.is_admin());

drop policy if exists "own read user_devices" on public.user_devices;
create policy "own read user_devices"
  on public.user_devices for select
  using (user_id = auth.uid() or public.is_staff());
drop policy if exists "own insert user_devices" on public.user_devices;
create policy "own insert user_devices"
  on public.user_devices for insert
  with check (user_id = auth.uid());
drop policy if exists "own update user_devices" on public.user_devices;
create policy "own update user_devices"
  on public.user_devices for update
  using (user_id = auth.uid() or public.is_staff());
drop policy if exists "own delete user_devices" on public.user_devices;
create policy "own delete user_devices"
  on public.user_devices for delete
  using (user_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------
-- 4. profiles - ADDITIVE convenience/enrichment columns only.
--    profiles already has id, name, phone, address, role, theme_preference,
--    tier, created_at. Nothing existing is touched.
-- ---------------------------------------------------------------------
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists avatar_color text;
alter table public.profiles add column if not exists city text;
alter table public.profiles add column if not exists country text;
alter table public.profiles add column if not exists timezone text;
alter table public.profiles add column if not exists units text;
alter table public.profiles add column if not exists locale text;
alter table public.profiles add column if not exists last_seen_at timestamptz;
alter table public.profiles add column if not exists onboarding_step text;

-- ---------------------------------------------------------------------
-- 5. updated_at triggers (same shape as car_profiles).
-- ---------------------------------------------------------------------
create or replace function public.touch_device_models()
returns trigger set search_path = public as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists device_models_touch on public.device_models;
create trigger device_models_touch before update on public.device_models
for each row execute function public.touch_device_models();

create or replace function public.touch_devices()
returns trigger set search_path = public as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists devices_touch on public.devices;
create trigger devices_touch before update on public.devices
for each row execute function public.touch_devices();

create or replace function public.touch_user_devices()
returns trigger set search_path = public as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists user_devices_touch on public.user_devices;
create trigger user_devices_touch before update on public.user_devices
for each row execute function public.touch_user_devices();

-- ---------------------------------------------------------------------
-- 6. Seed the 6 fleet models from guide/DEVICE-REGISTRY.json.
--    ON CONFLICT DO UPDATE so re-running is safe, and the manifest stays the
--    single place a model is edited.
--    NOTE: 4WD4M bt_name '4WD CAR' and remote 'REMOTE_CTRL' both DEVIATE from
--    the repo-wide "advertised BT name = FW_NAME upper-cased" rule. Those
--    deviations are intentional and frozen; do not "fix" them.
-- ---------------------------------------------------------------------
insert into public.device_models
  (id, display_name, repo, fw_name, fw_version, bt_name, ap_ssid, ap_ip, ap_subnet, transports, sort_order)
values
  ('4wd4m', '4WD 4-Motor Car', 'Genum_4WD4M_CAR', '4WD4M Car', '1.0.0',
   '4WD CAR', '4WDCar_Wifi', '192.168.245.1', '192.168.245.0/24',
   '["classic-bt","wifi-ap","wifi-sta","http","websocket"]'::jsonb, 10),
  ('2wd1m', '2WD + Servo Car (1 Motor)', 'Genum_2WD1M_CAR', '2 Wheel Drive Car', '1.0.4',
   '2 WHEEL DRIVE CAR', null, null, null,
   '["classic-bt"]'::jsonb, 20),
  ('self-balancing', 'Self-Balancing Car', 'Genum_SELF_BALANCE_CAR', 'Self Balancing Bot', '1.2.2',
   'SELF BALANCING BOT', null, null, null,
   '["classic-bt","wifi"]'::jsonb, 30),
  ('wireless-car', 'Wireless Car', 'Genum_WIRELESS_CAR', 'Wireless Car', '1.8.0',
   'WIRELESS CAR', null, null, null,
   '["classic-bt","wifi-ap","wifi-sta","http","websocket"]'::jsonb, 40),
  ('smart-dustbin', 'Smart Dustbin', 'Genum_SMART_DUSTBIN', 'Smart Dustbin', '1.0.0',
   null, null, null, null,
   '["wifi"]'::jsonb, 50),
  ('remote-esp32', 'ESP32 Remote Controller', 'Genum_REMOTE_ESP32', 'Esp32 Remote', '1.6.7',
   'REMOTE_CTRL', 'ESP32_Remote_OTA', null, null,
   '["classic-bt","rf","wifi-ap-ota"]'::jsonb, 60)
on conflict (id) do update set
  display_name = excluded.display_name,
  repo         = excluded.repo,
  fw_name      = excluded.fw_name,
  fw_version   = excluded.fw_version,
  bt_name      = excluded.bt_name,
  ap_ssid      = excluded.ap_ssid,
  ap_ip        = excluded.ap_ip,
  ap_subnet    = excluded.ap_subnet,
  transports   = excluded.transports,
  sort_order   = excluded.sort_order;

-- ---------------------------------------------------------------------
-- 7. Reconcile robo_car_modes with the FIRMWARE, not with the app copy.
--
--    The 4wd4m row stored token 'BT'. The firmware's real mode token is
--    '4WD4M'; 'BT' is a LEGACY ALIAS kept only for "pre-v1.5.0 controllers"
--    (firmware X-8). Storing an alias in the token column misreports what the
--    car actually expects, so it is corrected here. Protocol behaviour is
--    unaffected: the app's command layer is bound to the bundled
--    roboCarCatalog tokens, not to this column.
--
--    Names are unified on the em dash (U+2014) ALREADY used by the app's
--    bundled roboCarCatalog, so a user on the DB path and a user on the
--    offline fallback path see the identical string. (An ASCII hyphen would
--    be safer in a terminal but would make online and offline disagree.)
--    device_index is PROTOCOL and is deliberately left untouched.
-- ---------------------------------------------------------------------
update public.robo_car_modes set token = '4WD4M', name = '4WD4M' where id = '4wd4m';
update public.robo_car_modes set name = 'Bluetooth — 2WD + Servo (1M)' where id = '2wd1m';
update public.robo_car_modes set name = 'Obstacle Avoidance — Ultrasonic' where id = 'obstacle-us';
update public.robo_car_modes set name = 'Obstacle Avoidance — IR' where id = 'obstacle-ir';
update public.robo_car_modes set name = 'Website Controlled — Client' where id = 'website-client';
update public.robo_car_modes set name = 'Website Controlled — Server' where id = 'website-server';
update public.robo_car_modes set name = 'Path Following — IR' where id = 'path-follow';
update public.robo_car_modes set name = 'Manual — RF' where id = 'rf-manual';
