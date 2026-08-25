-- GENUM SOLUTIONS - Supabase schema
-- Run once in the Supabase SQL Editor. Safe to re-run section by section.
-- If you already ran an earlier version, just run the PROFILES section's
-- "protect_role_column" trigger block at the end.

-- ===== PROFILES (extends Supabase Auth users) =====
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  phone text not null default '',
  address text not null default '',
  role text not null default 'customer' check (role in ('customer','admin')),
  created_at timestamptz not null default now()
);

-- auto-create a profile whenever someone signs up
create or replace function public.handle_new_user()
returns trigger security definer set search_path = public as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)));
  return new;
end;
$$ language plpgsql;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- SECURITY: only the dashboard/SQL editor or the service role may change roles,
-- so a signed-in customer can never promote their own account to admin.
create or replace function public.protect_role_column()
returns trigger security definer set search_path = public as $$
begin
  if new.role is distinct from old.role
     and current_setting('role') not in ('postgres', 'service_role', 'supabase_admin') then
    raise exception 'Only administrators can change roles.';
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists profiles_protect_role on public.profiles;
create trigger profiles_protect_role
before update on public.profiles
for each row execute function public.protect_role_column();

-- ===== PRODUCTS =====
create table if not exists public.products (
  id text primary key,
  name text not null,
  category text not null,
  price integer not null default 0,
  price_label text not null default 'Request quote',
  sku text not null default '',
  product_type text not null default 'Retail kit',
  note text not null default '',
  description text not null default '',
  specs jsonb not null default '[]',
  audience text not null default '',
  difficulty text not null default 'Beginner',
  warranty text not null default '',
  stock integer not null default 0,
  delivery text not null default '',
  color text not null default 'from-[#dce8ff] to-[#7e9ff2]',
  badge text,
  supplier text,
  image_url text,
  sort_order integer not null default 1000,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists products_category_idx on public.products(category);

-- ===== SITE CONTENT (single row) =====
create table if not exists public.site_content (
  id integer primary key default 1 check (id = 1),
  home_title text not null,
  home_body text not null,
  updated_at timestamptz not null default now()
);
insert into public.site_content (id, home_title, home_body) values
  (1,
   'Technology you can touch, test, and trust.',
   'Robotics kits, project solutions, fabrication, open tools, and training for curious builders, schools, and teams.')
on conflict (id) do nothing;

-- ===== CARTS =====
create table if not exists public.carts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  lines jsonb not null default '[]',
  updated_at timestamptz not null default now()
);

-- ===== ORDERS =====
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  items jsonb not null default '[]',
  total_npr integer not null default 0,
  status text not null default 'pending'
    check (status in ('pending','paid','fulfilled','cancelled')),
  provider text not null default 'cod',
  customer_name text not null default '',
  email text not null default '',
  phone text not null default '',
  address text not null default '',
  provider_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists orders_user_idx on public.orders(user_id);

-- ===== CUSTOMER MESSAGES =====
create table if not exists public.customer_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  email text not null,
  message text not null,
  status text not null default 'new' check (status in ('new','replied')),
  created_at timestamptz not null default now()
);
create index if not exists messages_user_idx on public.customer_messages(user_id);

-- ===== TRANSACTIONS (append-only payment ledger) =====
-- One row per payment event across eSewa / Khalti / COD.
-- Written by server routes using the service role; readable by admins.
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  provider text not null check (provider in ('esewa','khalti','cod')),
  provider_ref text not null default '',
  amount_npr integer not null default 0,
  currency text not null default 'NPR',
  status text not null check (status in ('initiated','succeeded','failed')),
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists transactions_order_idx on public.transactions(order_id);
create index if not exists transactions_provider_ref_idx on public.transactions(provider_ref);

-- ===== ROW LEVEL SECURITY =====
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.site_content enable row level security;
alter table public.carts enable row level security;
alter table public.orders enable row level security;
alter table public.customer_messages enable row level security;
alter table public.transactions enable row level security;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- profiles: see/edit your own; admins see all
drop policy if exists "own profile select" on public.profiles;
create policy "own profile select" on public.profiles for select using (id = auth.uid() or public.is_admin());
drop policy if exists "own profile update" on public.profiles;
create policy "own profile update" on public.profiles for update using (id = auth.uid());

-- products: anyone can read; writes restricted to admins (and the server's service role)
drop policy if exists "public read products" on public.products;
create policy "public read products" on public.products for select using (true);
drop policy if exists "admin write products" on public.products;
create policy "admin write products" on public.products for all using (public.is_admin());

-- site content: public read, admin write
drop policy if exists "public read site content" on public.site_content;
create policy "public read site content" on public.site_content for select using (true);
drop policy if exists "admin write site content" on public.site_content;
create policy "admin write site content" on public.site_content for all using (public.is_admin());

-- carts: owner only
drop policy if exists "own cart" on public.carts;
create policy "own cart" on public.carts for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- orders: customers create/view own; admin manages all
drop policy if exists "own orders select" on public.orders;
create policy "own orders select" on public.orders for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists "own orders insert" on public.orders;
create policy "own orders insert" on public.orders for insert with check (user_id = auth.uid());
drop policy if exists "admin orders update" on public.orders;
create policy "admin orders update" on public.orders for update using (public.is_admin());

-- messages: customers create/view own; admin manages; guests may send via the contact form
drop policy if exists "own messages select" on public.customer_messages;
create policy "own messages select" on public.customer_messages for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists "own messages insert" on public.customer_messages;
create policy "own messages insert" on public.customer_messages for insert with check (user_id = auth.uid());
drop policy if exists "admin messages manage" on public.customer_messages;
create policy "admin messages manage" on public.customer_messages for update using (public.is_admin());
drop policy if exists "anon message insert" on public.customer_messages;
create policy "anon message insert" on public.customer_messages for insert to anon with check (true);

-- transactions: admins read; only the server's service role writes (no client
-- insert/update policies on purpose - the ledger is append-only and tamper-proof)
drop policy if exists "admin read transactions" on public.transactions;
create policy "admin read transactions" on public.transactions for select using (public.is_admin());

-- ===== STORAGE: product image bucket =====
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "public read images" on storage.objects;
create policy "public read images" on storage.objects for select using (bucket_id = 'product-images');
drop policy if exists "admin upload images" on storage.objects;
create policy "admin upload images" on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and public.is_admin());
drop policy if exists "admin update images" on storage.objects;
create policy "admin update images" on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and public.is_admin());
drop policy if exists "admin delete images" on storage.objects;
create policy "admin delete images" on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and public.is_admin());

-- ===== ADMIN HELPER: promote a user by email =====
create or replace function public.set_admin(target_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid;
begin
  select id into uid from auth.users where email = target_email;
  if uid is null then
    raise exception 'No user found with email %', target_email;
  end if;

  -- Upsert instead of update: also works when the profile row is missing
  -- (e.g. the user was created before this schema was applied).
  insert into public.profiles (id, name, role)
  values (uid, split_part(target_email, '@', 1), 'admin')
  on conflict (id) do update set role = 'admin';
end;
$$;

-- Only the SQL editor (postgres) or the service role may execute this;
-- clients get "permission denied" instead of ever reaching the function.
revoke all on function public.set_admin(text) from public;
revoke all on function public.set_admin(text) from anon;
revoke all on function public.set_admin(text) from authenticated;

-- ===== SERVICES (manageable from admin) =====
create table if not exists public.services (
  id text primary key,
  name text not null,
  category text not null default 'General',
  price_label text not null default 'Request quote',
  description text not null default '',
  tag text not null default '',
  sort_order integer not null default 1000,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- seed the 6 original services
insert into public.services (id, name, category, price_label, description, tag, sort_order) values
  ('website-design', 'Website Design & Development', 'Digital', 'from NPR 35,000', 'Fast, responsive business websites, content systems, and online stores for schools, institutions, makers, and growing teams.', 'Website', 1),
  ('3d-printing', '3D Printing Services', 'Fabrication', 'from NPR 2,500', 'Custom parts, prototypes, enclosures, classroom models, filament guidance, and design support. Send a model for a print quote.', 'Fabrication', 2),
  ('2d-printing', '2D Printing Press', 'Print', 'Request a quote', 'Flyers, posters, student reports, branding materials, stickers, and banners for schools, events, and businesses.', 'Print', 3),
  ('robotics-workshops', 'Robotics Workshops', 'Learning', 'from NPR 25,000', 'Hands-on sessions for students, hobbyists, clubs, and teaching institutions using practical robotics builds.', 'Learning', 4),
  ('school-packages', 'School Packages', 'Education', 'Scoped proposal', 'Kits plus teacher enablement, curriculum support, classroom delivery, and a structured robotics lab starting point.', 'Education', 5),
  ('lab-consultation', 'Robotics Lab Consultation', 'Consulting', 'Request a quote', 'Plan a lab around available space, learner age, inventory, safety, project progression, and equipment priorities.', 'Consulting', 6)
on conflict (id) do nothing;

-- ===== ACTIVITY LOG (admin actions, order events, signups) =====
create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists activity_user_idx on public.activity_log(user_id);
create index if not exists activity_created_idx on public.activity_log(created_at desc);

-- ===== PAGE VIEWS (lightweight analytics) =====
create table if not exists public.page_views (
  id uuid primary key default gen_random_uuid(),
  path text not null,
  user_id uuid references auth.users(id) on delete set null,
  referrer text,
  created_at timestamptz not null default now()
);
create index if not exists page_views_path_idx on public.page_views(path);
create index if not exists page_views_created_idx on public.page_views(created_at desc);

-- ===== RLS for new tables =====
alter table public.services enable row level security;
alter table public.activity_log enable row level security;
alter table public.page_views enable row level security;

-- services: public read, admin write
drop policy if exists "public read services" on public.services;
create policy "public read services" on public.services for select using (active = true or public.is_admin());
drop policy if exists "admin write services" on public.services;
create policy "admin write services" on public.services for all using (public.is_admin());

-- activity_log: admin read only; server writes via service role
drop policy if exists "admin read activity" on public.activity_log;
create policy "admin read activity" on public.activity_log for select using (public.is_admin());

-- page_views: admin read only; anon insert allowed for tracking
drop policy if exists "anon insert page views" on public.page_views;
create policy "anon insert page views" on public.page_views for insert to anon with check (true);
drop policy if exists "admin read page views" on public.page_views;
create policy "admin read page views" on public.page_views for select using (public.is_admin());
