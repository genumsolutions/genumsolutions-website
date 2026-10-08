-- Device crash / health reports
--
-- Owner directive 2026-10-08: when the app connects to a car it must share the
-- car's last stored diagnostics (reset_reason, crash_count, boot_count,
-- last_crash_phase, last_crash_heap) so firmware faults can be tracked and
-- fixed across the fleet. One row per connection session (not one per poll).
--
-- Everything here is ADDITIVE and idempotent. No existing table is dropped,
-- renamed or has a column removed.
--
-- Device identity: `board_id` is the firmware ESP.getEfuseMac() last-6 hex that
-- the car already reports as JSON `id` and the app already uses as
-- `car_profiles.profile_key` (`fw:<boardId>`). `device_id` is the optional FK to
-- public.devices when the board resolves to a known unit. RLS treats a report as
-- device health telemetry: owners read their own, staff/admin read all, and any
-- caller (including anon, because an unpaired car has no account) may insert.

create table if not exists public.device_crash_reports (
  id uuid primary key default gen_random_uuid(),
  device_id uuid references public.devices(id) on delete set null,
  board_id text not null default '',
  model_id text,
  fw_version text not null default '',
  app_version text not null default '',
  platform text not null default '',
  connection_method text not null default '',
  ssid text,
  ip text,
  reset_reason text,
  boot_count integer,
  crash_count integer,
  last_crash_phase text,
  last_crash_heap integer,
  free_heap integer,
  uptime_ms bigint,
  status_json jsonb,
  has_crash boolean not null default false,
  reported_at timestamptz not null default now(),
  synced_at timestamptz not null default now(),
  sync_status text not null default 'synced'
    check (sync_status in ('pending', 'synced', 'failed')),
  user_id uuid references auth.users(id) on delete set null,
  -- text, not uuid: the app mints an opaque per-link id and must never be
  -- forced to shape it as a uuid to report a diagnostic.
  session_id text
);

alter table public.device_crash_reports enable row level security;

create index if not exists device_crash_reports_board_idx
  on public.device_crash_reports (board_id, reported_at desc);
create index if not exists device_crash_reports_device_idx
  on public.device_crash_reports (device_id, reported_at desc);
create index if not exists device_crash_reports_user_idx
  on public.device_crash_reports (user_id, reported_at desc);
create index if not exists device_crash_reports_crash_idx
  on public.device_crash_reports (has_crash, reported_at desc);

drop policy if exists "read own crash reports" on public.device_crash_reports;
create policy "read own crash reports"
  on public.device_crash_reports for select
  using (auth.uid() = user_id or public.is_staff() or public.is_admin());

drop policy if exists "insert crash reports" on public.device_crash_reports;
create policy "insert crash reports"
  on public.device_crash_reports for insert
  with check (true);

drop policy if exists "staff manage crash reports" on public.device_crash_reports;
create policy "staff manage crash reports"
  on public.device_crash_reports for update
  using (public.is_staff() or public.is_admin());

comment on table public.device_crash_reports is
  'Crash/reset telemetry the app syncs from the car on connect, for fleet firmware diagnostics.';