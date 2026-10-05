-- ---------------------------------------------------------------------
-- Relay token digests - the write side of the U-94 Internet-method relay
-- (guide/PLAN-2026-10-04-U94-INTERNET-METHOD-DESIGN.md §4 Phase 1)
--
-- What this stores
-- ----------------
-- One SHA-256 digest per physical unit: the digest of that car's RELAY token,
-- salted by board id and peppered with RELAY_TOKEN_PEPPER. That digest is the
-- only thing the relay compares a presented token against, so a car with no
-- row here is a car the relay refuses - which is the intended behaviour, not a
-- gap (Q2 ruling: identity and claiming stay with the existing device
-- registry; there is no second identity path and no OLED PIN).
--
-- Why a SEPARATE table instead of a `relay_token_digest` column on `devices`
-- ----------------------------------------------------------------------------
-- Because `devices` is readable by every user who has claimed the unit:
--
--   create policy "owner read devices" on public.devices
--     for select using (public.is_staff() or exists (... user_devices ...));
--
-- A column on that table is therefore handed to the owner's phone, the owner's
-- browser and anything else holding the anon key. A peppered digest is not the
-- token, but it IS the verifier for a token that drives a car - and this
-- project has a standing rule (W-14, and the relay's own §3) that a
-- credential's verifier never rides out to a client. Postgres cannot
-- column-revoke a table-level SELECT, so the separation has to be structural:
-- a table with RLS enabled and NO policies is invisible to anon and
-- authenticated, and only the service role (which bypasses RLS) can read or
-- write it. The relay edge function holds that key.
--
-- What is deliberately NOT here
-- ------------------------------
-- No token column, no plain hash, no last_seen column, no per-frame anything.
-- The relay is a byte pipe that stores nothing about car state
-- (relay-core.ts); this table holds exactly one secret verifier per car and
-- nothing else.
--
-- Everything here is ADDITIVE and idempotent: no existing table, column,
-- policy or grant is dropped or altered.
--
-- HOW TO APPLY (owner): `npm run db:apply` reads ONLY supabase/schema.sql - it
-- does not walk supabase/migrations/, so this file is applied with the SQL
-- editor or `supabase db push`. Same is true of the device-registry
-- migrations beside it. Apply this BEFORE deploying the car-relay function:
-- without the table the relay's digest read fails and every car is refused.
-- ---------------------------------------------------------------------

create table if not exists public.device_relay_tokens (
  device_id uuid primary key references public.devices(id) on delete cascade,
  -- 64 lowercase hex chars: the output of SHA-256. Constrained in the schema
  -- so a truncated or placeholder digest can never be stored and then read as
  -- "this car has a token configured" by the relay's own query.
  token_digest text not null check (token_digest ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS ON with no policies: anon/authenticated get nothing (an empty policy set
-- denies, it does not fall through), service_role bypasses RLS entirely. This
-- is the mechanism, so it is stated as a comment the next reader cannot miss.
alter table public.device_relay_tokens enable row level security;

-- Belt and braces: even if a policy is ever added by mistake, the client roles
-- hold no privileges on this table at all.
revoke all on table public.device_relay_tokens from anon;
revoke all on table public.device_relay_tokens from authenticated;

create or replace function public.touch_device_relay_tokens()
returns trigger set search_path = public as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists device_relay_tokens_touch on public.device_relay_tokens;
create trigger device_relay_tokens_touch before update on public.device_relay_tokens
for each row execute function public.touch_device_relay_tokens();

comment on table public.device_relay_tokens is
  'One peppered SHA-256 relay-token digest per physical unit (U-94 Internet method). Service-role only: RLS is enabled with no policies, so no client role can read or write it. Never store the token itself.';
comment on column public.device_relay_tokens.token_digest is
  'SHA-256 hex of RELAY_TOKEN_PEPPER + ''genum-relay:v1:<boardIdHex>'' + token. Written only by the car-relay edge function on an authenticated enroll request from an owner who has claimed that unit.';