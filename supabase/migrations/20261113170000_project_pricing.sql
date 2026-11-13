-- 2026-11-13: project pricing table + seed (draft by default).
-- Mirrors the 3D print studio pattern (print_settings / print_materials) but
-- project-specific: a project is priced from its linked catalog components
-- (project_components join) + a package base charge + optional extras + bulk
-- tiers + a minimum order. All DRAFT until an admin approves in the Projects
-- tab (Admin → Projects → Pricing), same gating as 3D print rates.
--
-- Source of truth for the NUMBERS: there are no docx numbers for project
-- packages (the docx lists them as quote-based). Default to 0 / "rate on
-- request" until the owner enters real base charges / markups / extras / tiers.
-- No payment code touched.
--
-- Idempotent: safe to re-run (create table if not exists + guarded constraint
-- + on-conflict-do-nothing seed).

create table if not exists public.project_pricing (
  -- one row per project package (id references products.id)
  id text primary key references public.products(id) on delete cascade,
  -- base charge for the package itself (NPR), before components/extras
  package_base_charge integer not null default 0 check (package_base_charge >= 0),
  -- component unit price is the catalog product's price * (1 + markupPercent/100).
  -- 0 means use the catalog price as-is; 100 means double it, etc.
  component_markup_percent integer not null default 0 check (component_markup_percent >= 0 and component_markup_percent <= 500),
  -- optional extras a buyer can add to a project quote (training, assembly, docs, delivery)
  extras jsonb not null default '[]',
  -- quantity -> % off the subtotal (parallel to print bulk_tiers)
  bulk_tiers jsonb not null default '[]',
  -- minimum quote value (NPR); below it the quote is auto-elevated (parallel to print minimum_order)
  minimum_order integer not null default 0 check (minimum_order >= 0),
  -- publication status: draft hides every price ("rate on request"); approved reveals them
  price_status text not null default 'draft',
  -- when the owner approved / last withdrew
  price_approved_at timestamptz,
  -- who approved / last withdrew
  price_approved_by text not null default '',
  note text not null default '',
  updated_at timestamptz not null default now(),
  constraint project_pricing_price_status_check check (price_status in ('draft', 'approved'))
);

-- The FK is declared inline above; for a pre-existing table created without it,
-- add it once (Postgres has no ADD CONSTRAINT IF NOT EXISTS).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'project_pricing_id_fkey'
  ) then
    alter table public.project_pricing
      add constraint project_pricing_id_fkey
      foreign key (id) references public.products(id) on delete cascade;
  end if;
end $$;

alter table public.project_pricing enable row level security;

-- Public read: only approved rows are visible to anonymous users (the public
-- API, the storefront and the app show prices only after an admin approves).
drop policy if exists "public read approved project pricing" on public.project_pricing;
create policy "public read approved project pricing" on public.project_pricing
  for select using (price_status = 'approved');

-- Staff read: staff+ sees every row (draft + approved) so the admin editor can
-- edit draft pricing.
drop policy if exists "staff read project pricing" on public.project_pricing;
create policy "staff read project pricing" on public.project_pricing
  for select using (public.is_staff());

-- Staff write: staff+ can insert/update project pricing rows (same shape as the
-- print studio's staff insert/update policies; the website route additionally
-- restricts approve/withdraw to admins).
drop policy if exists "staff write project pricing" on public.project_pricing;
create policy "staff write project pricing" on public.project_pricing
  for all using (public.is_staff()) with check (public.is_staff());

-- Admin delete: only admin+owner may delete a project pricing row.
drop policy if exists "admin delete project pricing" on public.project_pricing;
create policy "admin delete project pricing" on public.project_pricing
  for delete using (public.is_admin());

-- idempotent seed: draft defaults for any project package missing a pricing row.
insert into public.project_pricing
  (id, package_base_charge, component_markup_percent, extras, bulk_tiers, minimum_order, price_status, note)
  select id, 0, 0, '[]', '[]', 0, 'draft', ''
  from public.products
  where product_type = 'Project package'
    and not exists (select 1 from public.project_pricing pp where pp.id = products.id)
on conflict (id) do nothing;

comment on table public.project_pricing is
  '2026-11-13: per-project-package price calculator, managed from Admin → Projects → Pricing. Draft by default (rates hidden, "rate on request"); approved to publish. Mirrors the 3D print studio pattern (print_settings / print_materials). No docx numbers to mirror — project packages are quote-based in the docx.';
