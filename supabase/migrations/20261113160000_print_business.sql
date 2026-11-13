-- =====================================================================
-- 2026-11-13 — 3D printing business layer
--
-- Adds the things the print studio was missing to be commercially
-- manageable (see the owner's 3D printing handoff, sections 5–17):
--
--   1. print_settings.pricing_status — nothing published until an admin
--      explicitly approves the rates. The calculator already ships off and
--      rates start at 0; this records the approval step itself.
--   2. print_services — the "custom print services" strip was hardcoded in
--      a component; it becomes editable, like every other print section.
--   3. print_costing — INTERNAL supplier/electricity/labour/margin inputs.
--      This table is staff-only on purpose: no public read policy at all.
--   4. print_quote_requests — the fields a workshop needs to turn a request
--      into a quoted job (amount, grams, print hours, reprint flag) plus
--      two workflow statuses the old check constraint rejected.
--
-- Additive and idempotent: safe to re-run. Nothing here publishes a price
-- or changes an existing row's commercial value.
-- =====================================================================

-- ---- 1. pricing approval -------------------------------------------------
alter table public.print_settings
  add column if not exists pricing_status text not null default 'draft';
alter table public.print_settings
  add column if not exists pricing_approved_at timestamptz;
alter table public.print_settings
  add column if not exists pricing_approved_by text not null default '';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'print_settings_pricing_status_check'
  ) then
    alter table public.print_settings
      add constraint print_settings_pricing_status_check
      check (pricing_status in ('draft', 'approved'));
  end if;
end $$;

-- ---- 2. custom services --------------------------------------------------
create table if not exists public.print_services (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  price_note text not null default '',
  sort_order integer not null default 1000,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.print_services enable row level security;

drop policy if exists "public read print services" on public.print_services;
create policy "public read print services" on public.print_services
  for select using (active = true or public.is_staff());
drop policy if exists "staff insert print services" on public.print_services;
create policy "staff insert print services" on public.print_services
  for insert with check (public.is_staff());
drop policy if exists "staff update print services" on public.print_services;
create policy "staff update print services" on public.print_services
  for update using (public.is_staff());
drop policy if exists "admin delete print services" on public.print_services;
create policy "admin delete print services" on public.print_services
  for delete using (public.is_admin());

-- Seed only when the table is empty, so owner edits are never overwritten.
insert into public.print_services (title, description, price_note, sort_order)
select seed.title, seed.description, seed.price_note, seed.sort_order
from (
  values
    ('Design for print', 'We prepare geometry, tolerances, supports and orientation so the first print is the right one.', 'From NPR 2,500', 1),
    ('File repair', 'Non-manifold meshes, missing walls and broken exports fixed before slicing.', 'From NPR 300', 2),
    ('Material guidance', 'PLA or PETG, wall count, infill and finish — chosen around how the part will be used.', '', 3),
    ('Scaling and fitting', 'Resize a model while keeping clearances that still work in the real world.', '', 4),
    ('Small-batch runs', 'Repeatable quantities for classroom sets, fixtures and product samples.', 'Quoted by volume', 5),
    ('Post-processing', 'Support removal, clean-up and finish options discussed with the quote.', 'Quoted per job', 6)
) as seed(title, description, price_note, sort_order)
where not exists (select 1 from public.print_services);

-- ---- 3. internal costing (staff only) ------------------------------------
create table if not exists public.print_costing (
  id integer primary key default 1 check (id = 1),
  filament_cost_per_gram numeric(10, 2) not null default 0 check (filament_cost_per_gram >= 0),
  wastage_percent integer not null default 10 check (wastage_percent >= 0 and wastage_percent <= 100),
  electricity_rate_per_kwh numeric(10, 2) not null default 0 check (electricity_rate_per_kwh >= 0),
  printer_watts integer not null default 0 check (printer_watts >= 0),
  machine_cost integer not null default 0 check (machine_cost >= 0),
  machine_life_hours integer not null default 0 check (machine_life_hours >= 0),
  maintenance_per_hour numeric(10, 2) not null default 0 check (maintenance_per_hour >= 0),
  labour_per_hour numeric(10, 2) not null default 0 check (labour_per_hour >= 0),
  packaging_per_job integer not null default 0 check (packaging_per_job >= 0),
  payment_fee_percent numeric(5, 2) not null default 0 check (payment_fee_percent >= 0),
  overhead_per_month integer not null default 0 check (overhead_per_month >= 0),
  monthly_order_target integer not null default 0 check (monthly_order_target >= 0),
  target_margin_percent integer not null default 60 check (target_margin_percent >= 0 and target_margin_percent <= 95),
  notes text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.print_costing enable row level security;

-- No public policy: internal costs must never reach a customer surface.
drop policy if exists "staff read print costing" on public.print_costing;
create policy "staff read print costing" on public.print_costing
  for select using (public.is_staff());
drop policy if exists "staff insert print costing" on public.print_costing;
create policy "staff insert print costing" on public.print_costing
  for insert with check (public.is_staff());
drop policy if exists "staff update print costing" on public.print_costing;
create policy "staff update print costing" on public.print_costing
  for update using (public.is_staff());

insert into public.print_costing (id) values (1) on conflict (id) do nothing;

-- ---- 4. quote workflow additions ----------------------------------------
alter table public.print_quote_requests
  add column if not exists quoted_amount integer not null default 0;
alter table public.print_quote_requests
  add column if not exists estimated_grams integer not null default 0;
alter table public.print_quote_requests
  add column if not exists print_hours numeric(6, 2) not null default 0;
alter table public.print_quote_requests
  add column if not exists reprint boolean not null default false;

alter table public.print_quote_requests
  drop constraint if exists print_quote_requests_status_check;
alter table public.print_quote_requests
  add constraint print_quote_requests_status_check check (
    status in (
      'new',
      'reviewing',
      'needs_info',
      'quoted',
      'approved',
      'printing',
      'ready',
      'completed',
      'rejected',
      'cancelled'
    )
  );
