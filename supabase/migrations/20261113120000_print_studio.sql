-- ===== 3D PRINT STUDIO (2026-11-13) =====
-- The 3D service is an EXTENSION of the existing catalog, not a second one:
-- 3D rows keep their `products` row (category '3D Models') and gain the print
-- fields below. Categories, materials/pricing, promotions, gallery and quote
-- requests are new tables managed from the existing admin "3D Products" tab.
--
-- Safe to re-run: every column/table/policy is created idempotently and the
-- seeds use `on conflict do nothing`, so re-applying never overwrites an edit
-- the owner has made in the admin.
--
-- NOTHING here publishes a price on its own: the calculator ships disabled and
-- the material rates are seeded at 0 (= "not published"). The owner sets the
-- rates in Admin → 3D Products → Pricing, then enables the calculator.

-- ---- product print fields ------------------------------------------------
alter table public.products add column if not exists print_category text not null default '';
alter table public.products add column if not exists material text not null default '';
alter table public.products add column if not exists dimensions text not null default '';
alter table public.products add column if not exists weight_grams integer not null default 0;
alter table public.products add column if not exists customization jsonb not null default '[]';
alter table public.products add column if not exists featured_print boolean not null default false;
create index if not exists products_print_category_idx on public.products(print_category);
create index if not exists products_featured_print_idx on public.products(featured_print)
  where featured_print;

-- ---- product categories (the 7 tiles on /3d-printing) --------------------
create table if not exists public.print_categories (
  id text primary key,
  name text not null,
  description text not null default '',
  image_url text not null default '',
  sort_order integer not null default 1000,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---- materials + the rates the calculator uses ---------------------------
-- rate_per_gram 0 means "rate not published yet"; the calculator falls back to
-- a request-a-quote state while any selected material is 0.
create table if not exists public.print_materials (
  id text primary key,
  name text not null,
  description text not null default '',
  rate_per_gram integer not null default 0 check (rate_per_gram >= 0),
  note text not null default '',
  sort_order integer not null default 1000,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---- single settings row --------------------------------------------------
create table if not exists public.print_settings (
  id integer primary key default 1 check (id = 1),
  calculator_enabled boolean not null default false,
  minimum_order integer not null default 300 check (minimum_order >= 0),
  design_base_charge integer not null default 2500 check (design_base_charge >= 0),
  finishing_charges jsonb not null default '[]',
  bulk_tiers jsonb not null default '[]',
  disclaimer text not null default '',
  hero_image text not null default '',
  materials_intro text not null default '',
  updated_at timestamptz not null default now()
);

-- ---- promotions -----------------------------------------------------------
create table if not exists public.print_promotions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null default '',
  image_url text not null default '',
  cta_label text not null default '',
  cta_href text not null default '',
  discount_type text not null default 'none' check (discount_type in ('none', 'percent', 'flat')),
  discount_value integer not null default 0 check (discount_value >= 0),
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean not null default false,
  sort_order integer not null default 1000,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---- gallery --------------------------------------------------------------
create table if not exists public.print_gallery (
  id uuid primary key default gen_random_uuid(),
  image_url text not null,
  caption text not null default '',
  category text not null default '',
  featured boolean not null default false,
  active boolean not null default true,
  sort_order integer not null default 1000,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---- quote requests -------------------------------------------------------
create table if not exists public.print_quote_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  email text not null,
  phone text not null default '',
  description text not null,
  material text not null default '',
  quantity integer not null default 1 check (quantity > 0),
  dimensions text not null default '',
  timeline text not null default '',
  reference_urls text[] not null default '{}',
  file_urls text[] not null default '{}',
  status text not null default 'new' check (
    status in (
      'new',
      'reviewing',
      'quoted',
      'approved',
      'printing',
      'ready',
      'completed',
      'cancelled'
    )
  ),
  admin_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists print_quotes_status_idx
  on public.print_quote_requests(status, created_at desc);
create index if not exists print_quotes_created_idx
  on public.print_quote_requests(created_at desc);

-- ---- seeds (never overwrite owner edits) ----------------------------------
insert into public.print_categories (id, name, description, sort_order) values
  ('home-decor', 'Home Decor', 'Vases, planters, wall pieces and tabletop objects printed in the finish you choose.', 1),
  ('educational-models', 'Educational Models', 'Teaching models and classroom sets for physics, biology, robotics and design classes.', 2),
  ('prototypes', 'Prototypes & Enclosures', 'Fit checks, housings and brackets that let you test a design before tooling.', 3),
  ('replacement-parts', 'Replacement Parts', 'One-off parts for equipment that is otherwise hard or slow to replace.', 4),
  ('scale-models', 'Scale & Architectural Models', 'Site models, building sections and presentation pieces built to scale.', 5),
  ('gifts', 'Gifts & Personalised', 'Name plates, trophies, keepsakes and small personalised runs.', 6),
  ('jigs-fixtures', 'Jigs & Fixtures', 'Shop-floor aids, alignment guides and repeatable production fixtures.', 7)
on conflict (id) do nothing;

insert into public.print_materials (id, name, description, rate_per_gram, note, sort_order) values
  ('pla', 'PLA', 'The everyday choice: crisp detail, easy to print, best for display models, teaching aids and prototypes that will not sit in a hot car.', 0, 'Rate pending owner approval.', 1),
  ('petg', 'PETG', 'Tougher and slightly flexible with better heat and water resistance — a good fit for brackets, jigs and parts that take a knock.', 0, 'Rate pending owner approval.', 2)
on conflict (id) do nothing;

insert into public.print_settings (id) values (1) on conflict (id) do nothing;

-- ---- RLS ------------------------------------------------------------------
alter table public.print_categories enable row level security;
alter table public.print_materials enable row level security;
alter table public.print_settings enable row level security;
alter table public.print_promotions enable row level security;
alter table public.print_gallery enable row level security;
alter table public.print_quote_requests enable row level security;

-- categories: published rows are public; staff manage
drop policy if exists "public read print categories" on public.print_categories;
create policy "public read print categories" on public.print_categories
  for select using (active = true or public.is_staff());
drop policy if exists "staff insert print categories" on public.print_categories;
create policy "staff insert print categories" on public.print_categories
  for insert with check (public.is_staff());
drop policy if exists "staff update print categories" on public.print_categories;
create policy "staff update print categories" on public.print_categories
  for update using (public.is_staff());
drop policy if exists "admin delete print categories" on public.print_categories;
create policy "admin delete print categories" on public.print_categories
  for delete using (public.is_admin());

-- materials: same pattern
drop policy if exists "public read print materials" on public.print_materials;
create policy "public read print materials" on public.print_materials
  for select using (active = true or public.is_staff());
drop policy if exists "staff insert print materials" on public.print_materials;
create policy "staff insert print materials" on public.print_materials
  for insert with check (public.is_staff());
drop policy if exists "staff update print materials" on public.print_materials;
create policy "staff update print materials" on public.print_materials
  for update using (public.is_staff());
drop policy if exists "admin delete print materials" on public.print_materials;
create policy "admin delete print materials" on public.print_materials
  for delete using (public.is_admin());

-- settings: one public row (copy + calculator defaults); staff edit
drop policy if exists "public read print settings" on public.print_settings;
create policy "public read print settings" on public.print_settings
  for select using (true);
drop policy if exists "staff insert print settings" on public.print_settings;
create policy "staff insert print settings" on public.print_settings
  for insert with check (public.is_staff());
drop policy if exists "staff update print settings" on public.print_settings;
create policy "staff update print settings" on public.print_settings
  for update using (public.is_staff());

-- promotions: only live, in-window rows reach the storefront
drop policy if exists "public read print promotions" on public.print_promotions;
create policy "public read print promotions" on public.print_promotions
  for select using (
    public.is_staff()
    or (
      active = true
      and (starts_at is null or starts_at <= now())
      and (ends_at is null or ends_at >= now())
    )
  );
drop policy if exists "staff insert print promotions" on public.print_promotions;
create policy "staff insert print promotions" on public.print_promotions
  for insert with check (public.is_staff());
drop policy if exists "staff update print promotions" on public.print_promotions;
create policy "staff update print promotions" on public.print_promotions
  for update using (public.is_staff());
drop policy if exists "admin delete print promotions" on public.print_promotions;
create policy "admin delete print promotions" on public.print_promotions
  for delete using (public.is_admin());

-- gallery: published entries are public
drop policy if exists "public read print gallery" on public.print_gallery;
create policy "public read print gallery" on public.print_gallery
  for select using (active = true or public.is_staff());
drop policy if exists "staff insert print gallery" on public.print_gallery;
create policy "staff insert print gallery" on public.print_gallery
  for insert with check (public.is_staff());
drop policy if exists "staff update print gallery" on public.print_gallery;
create policy "staff update print gallery" on public.print_gallery
  for update using (public.is_staff());
drop policy if exists "admin delete print gallery" on public.print_gallery;
create policy "admin delete print gallery" on public.print_gallery
  for delete using (public.is_admin());

-- quote requests: written ONLY by the server route (service role), read and
-- triaged by staff. No anon insert policy on purpose — that path must pass the
-- route's validation, rate limit and file checks.
drop policy if exists "staff read print quotes" on public.print_quote_requests;
create policy "staff read print quotes" on public.print_quote_requests
  for select using (public.is_staff());
drop policy if exists "staff update print quotes" on public.print_quote_requests;
create policy "staff update print quotes" on public.print_quote_requests
  for update using (public.is_staff());
drop policy if exists "admin delete print quotes" on public.print_quote_requests;
create policy "admin delete print quotes" on public.print_quote_requests
  for delete using (public.is_admin());

-- ---- storage: private quote files ----------------------------------------
-- Private on purpose: customer CAD files are not public content. The quote
-- route uploads with the service role; the admin panel reads them through
-- short-lived signed URLs (see app/api/admin/print/route.ts).
insert into storage.buckets (id, name, public)
values ('print-quote-files', 'print-quote-files', false)
on conflict (id) do update set public = false;
