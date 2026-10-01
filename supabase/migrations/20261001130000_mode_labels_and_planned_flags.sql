-- Normalise the `car` label in robo_car_modes + flag the modes that have no
-- firmware yet. Owner decision 2026-10-01.
--
-- 1. `car` is DISPLAY-ONLY. Verified before changing it: in the app it is
--    rendered in exactly one place (ProjectInfo.tsx "Build" row) and is never
--    used as a match key, and no other table stores the raw slug. So these
--    edits are cosmetic and cannot orphan data. The live car_profiles row
--    proves the underlying point - its car_name is a raw MAC address
--    (08:B6:1F:98:2F:F6), which is why per-unit naming now lives in
--    user_devices instead.
--
-- 2. `is_planned` marks the five modes whose firmware does not exist yet, so
--    the app can never imply a car that is not built. product_id is filled
--    only where a real product already links to the mode.
--
-- `token` and `device_index` are PROTOCOL and are NOT touched here.
create table if not exists public.robo_car_modes_flags (
  mode_id text primary key references public.robo_car_modes(id) on delete cascade,
  is_planned boolean not null default false,
  firmware_repo text,
  note text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.robo_car_modes_flags enable row level security;
drop policy if exists "public read robo_car_modes_flags" on public.robo_car_modes_flags;
create policy "public read robo_car_modes_flags"
  on public.robo_car_modes_flags for select using (true);
drop policy if exists "staff write robo_car_modes_flags" on public.robo_car_modes_flags;
create policy "staff write robo_car_modes_flags"
  on public.robo_car_modes_flags for update using (public.is_staff());
drop policy if exists "staff insert robo_car_modes_flags" on public.robo_car_modes_flags;
create policy "staff insert robo_car_modes_flags"
  on public.robo_car_modes_flags for insert with check (public.is_staff());

-- Human title case, one style everywhere (was: 4-wheel-drive, 2-wheel-drive,
-- Self-balancing, Obstacle avoider, Website car, Line follower, RF car).
update public.robo_car_modes set car = '4-Wheel Drive' where id = '4wd4m';
update public.robo_car_modes set car = '2-Wheel Drive' where id = '2wd1m';
update public.robo_car_modes set car = 'Obstacle Avoider' where id in ('obstacle-us','obstacle-ir');
update public.robo_car_modes set car = 'Website Car' where id in ('website-client','website-server');
update public.robo_car_modes set car = 'Line Follower' where id = 'path-follow';
update public.robo_car_modes set car = 'RF Car' where id = 'rf-manual';

insert into public.robo_car_modes_flags (mode_id, is_planned, firmware_repo, note)
values
  ('4wd4m',          false, 'Genum_4WD4M_CAR',  'Mode is LIVE on the car. Transport tests (4WD4M) still pending.'),
  ('2wd1m',          false, 'Genum_2WD1M_CAR',  'Mode is LIVE on the car.'),
  ('self-balancing', false, 'Genum_SELF_BALANCE_CAR', 'Mode is LIVE on the car.'),
  ('obstacle-us',    true,  null, 'Firmware not built yet - no repository exists. Sellable product, unbuilt mode.'),
  ('obstacle-ir',    true,  null, 'Firmware not built yet - no repository exists. Sellable product, unbuilt mode.'),
  ('website-client', true,  null, 'Firmware not built yet. Same function as the 4WD4M own ESP_CLI transport.'),
  ('website-server', true,  null, 'Firmware not built yet. Same function as the 4WD4M own ESP_SER transport.'),
  ('path-follow',    true,  null, 'Firmware not built yet - no repository exists.'),
  ('rf-manual',      true,  'Genum_REMOTE_ESP32', 'Handled by the remote, not the car. Transport tests (Remote) still pending.')
on conflict (mode_id) do update set
  is_planned    = excluded.is_planned,
  firmware_repo = excluded.firmware_repo,
  note          = excluded.note;
