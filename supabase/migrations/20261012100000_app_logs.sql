-- App error / diagnostic logs
--
-- Owner directive 2026-10-12: the app's logger was console-only, so a runtime
-- error lived on one phone and died with it. The app now keeps a bounded
-- AsyncStorage ring buffer and flushes warn/error lines to this table (on link
-- and on a small fire-and-forget interval), so staff/admin can read what the
-- app has been doing across devices, projects and cars — one shared medium
-- instead of per-device console scraping.
--
-- Everything here is ADDITIVE and idempotent. No existing table is dropped,
-- renamed or has a column removed.
--
-- `scope` is the logger's short lowercase module tag ('spp', 'wifi', 'push',
-- 'admin', 'car', ...) so lines stay greppable side-by-side with the console
-- format. `detail` is JSON when the call site attached one (an error object
-- shape, a payload excerpt); inserts store it as-is, it is never evaluated.
-- Games/website staff read; an anon/guest app may only write its own (user_id
-- null) rows so nobody can forge a log under another account.

create table if not exists public.app_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  device_id uuid references public.devices(id) on delete set null,
  app_version text not null default '',
  platform text not null default '',
  scope text not null default '',
  level text not null default 'error'
    check (level in ('info', 'warn', 'error')),
  message text not null default '',
  detail jsonb,
  created_at timestamptz not null default now()
);

alter table public.app_logs enable row level security;

create index if not exists app_logs_created_idx
  on public.app_logs (created_at desc);
create index if not exists app_logs_level_idx
  on public.app_logs (level, created_at desc);
create index if not exists app_logs_scope_idx
  on public.app_logs (scope, created_at desc);
create index if not exists app_logs_user_idx
  on public.app_logs (user_id, created_at desc);

drop policy if exists "read own app logs" on public.app_logs;
create policy "read own app logs"
  on public.app_logs for select
  using (auth.uid() = user_id or public.is_staff() or public.is_admin());

drop policy if exists "insert own app logs" on public.app_logs;
create policy "insert own app logs"
  on public.app_logs for insert
  with check (user_id is null or auth.uid() = user_id);

drop policy if exists "staff manage app logs" on public.app_logs;
create policy "staff manage app logs"
  on public.app_logs for update
  using (public.is_staff() or public.is_admin());

drop policy if exists "staff delete app logs" on public.app_logs;
create policy "staff delete app logs"
  on public.app_logs for delete
  using (public.is_staff() or public.is_admin());

comment on table public.app_logs is
  'Warn/error ring-buffer rows flushed from the app; read by staff/admin for diagnostics across the fleet.';