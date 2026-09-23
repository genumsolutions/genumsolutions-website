-- GENUM SOLUTIONS - Supabase schema
-- Can be applied automatically: `npm run db:apply` (or `db:apply:seed`)
-- from the website repo, which needs SUPABASE_DB_URL in .env.local.
-- Also safe to run section by section in the Supabase SQL Editor.
-- If you already ran an earlier version, just run the PROFILES section's
-- "protect_role_column" trigger block at the end.
-- The file is idempotent: create table/function/index/policy ... if
-- not exists + drop ... if exists, so re-running is safe.

-- ===== PROFILES (extends Supabase Auth users) =====
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  phone text not null default '',
  address text not null default '',
  role text not null default 'customer' check (role in ('customer','staff','admin','owner')),
  theme_preference text not null default 'system',
  created_at timestamptz not null default now()
);

-- W-6 (2026-09-21): theme preference (system/light/dim) shared by the app and
-- the website through Supabase. Guarded ADD for databases created before the
-- column existed (create table if not exists does not alter existing tables).
alter table public.profiles add column if not exists theme_preference text not null default 'system';
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_theme_preference_check'
  ) then
    alter table public.profiles
      add constraint profiles_theme_preference_check
      check (theme_preference in ('system','light','dim'));
  end if;
end $$;

-- RBAC levels (2026-09-22): customer / staff / admin / owner. Guarded ADD
-- for databases created with the older two-value check (same idempotent
-- pattern as theme_preference). staff = all admin powers EXCEPT deletions;
-- owner = admin powers + delete-user (sole owner account is set below).
do $$
begin
  if exists (
    select 1 from pg_constraint where conname = 'profiles_role_check'
    and pg_get_constraintdef(oid) !~ 'owner'
  ) then
    alter table public.profiles drop constraint profiles_role_check;
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_role_check'
  ) then
    alter table public.profiles
      add constraint profiles_role_check
      check (role in ('customer','staff','admin','owner'));
  end if;
end $$;

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
  inventory_type text not null default 'Catalog',
  active boolean not null default true,
  project_overview text not null default '',
  objectives jsonb not null default '[]',
  materials_required jsonb not null default '[]',
  learning_outcomes jsonb not null default '[]',
  build_steps jsonb not null default '[]',
  control_methods jsonb not null default '[]',
  prerequisites jsonb not null default '[]',
  deliverables jsonb not null default '[]',
  estimated_duration text not null default '',
  source_folder text not null default '',
  documentation_url text not null default '',
  video_url text not null default '',
  maintenance_notes text not null default '',
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
alter table public.products add column if not exists inventory_type text not null default 'Catalog';
alter table public.products add column if not exists active boolean not null default true;
alter table public.products add column if not exists project_overview text not null default '';
alter table public.products add column if not exists objectives jsonb not null default '[]';
alter table public.products add column if not exists materials_required jsonb not null default '[]';
alter table public.products add column if not exists learning_outcomes jsonb not null default '[]';
alter table public.products add column if not exists build_steps jsonb not null default '[]';
alter table public.products add column if not exists control_methods jsonb not null default '[]';
alter table public.products add column if not exists prerequisites jsonb not null default '[]';
alter table public.products add column if not exists deliverables jsonb not null default '[]';
alter table public.products add column if not exists estimated_duration text not null default '';
alter table public.products add column if not exists source_folder text not null default '';
alter table public.products add column if not exists documentation_url text not null default '';
alter table public.products add column if not exists video_url text not null default '';
alter table public.products add column if not exists maintenance_notes text not null default '';
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

-- ===== ROBO CAR MODES (manageable from admin) =====
-- Create this table before its RLS policies below.
create table if not exists public.robo_car_modes (
  id text primary key,
  name text not null,
  token text not null,
  device_index integer not null,
  car text not null,
  wheel text not null,
  steering text not null,
  sensors text not null default '[]',
  transport text not null default '[]',
  remote_with text not null default '',
  controls text not null default '[]',
  requires_connection boolean not null default true,
  blurb text not null default '',
  sort_order integer not null default 1000,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ===== ROW LEVEL SECURITY =====
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.site_content enable row level security;
alter table public.carts enable row level security;
alter table public.orders enable row level security;
alter table public.customer_messages enable row level security;
alter table public.transactions enable row level security;

-- Role-rank helpers (2026-09-22, RBAC levels customer < staff < admin < owner).
--   is_staff()  — any signed-in member with staff powers (staff, admin, owner)
--   is_admin()  — full admin powers incl. deletion (admin, owner)
--   is_owner()  — the single owner account (delete-user is owner-only)
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('staff','admin','owner'));
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','owner'));
$$;

create or replace function public.is_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'owner');
$$;

-- Admin-only aggregate so native clients can read cart totals without
-- broad access to every customer's cart row.
create or replace function public.get_admin_cart_stats()
returns table (total_cart_items bigint, active_carts bigint)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'Only staff members can view cart statistics.';
  end if;
  return query
    select
      coalesce((select sum((line->>'quantity')::bigint)
        from public.carts as cart
        cross join lateral jsonb_array_elements(cart.lines) as line), 0)::bigint,
      (select count(*) from public.carts where jsonb_array_length(lines) > 0)::bigint;
end;
$$;
revoke all on function public.get_admin_cart_stats() from public;
grant execute on function public.get_admin_cart_stats() to authenticated;

-- profiles: see/edit your own; staff+ see all (Users tab on both clients)
drop policy if exists "own profile select" on public.profiles;
create policy "own profile select" on public.profiles for select using (id = auth.uid() or public.is_staff());
drop policy if exists "own profile update" on public.profiles;
create policy "own profile update" on public.profiles for update using (id = auth.uid());

-- products: anyone can read; writes restricted to staff+ (edit/insert) and
-- admin+ (delete) — the server's service role bypasses all of this
drop policy if exists "public read products" on public.products;
create policy "public read products" on public.products for select using (true or public.is_staff());
drop policy if exists "admin write products" on public.products;
drop policy if exists "staff insert products" on public.products;
create policy "staff insert products" on public.products for insert with check (public.is_staff());
drop policy if exists "staff update products" on public.products;
create policy "staff update products" on public.products for update using (public.is_staff());
drop policy if exists "admin delete products" on public.products;
create policy "admin delete products" on public.products for delete using (public.is_admin());

-- site content: public read, staff edit, admin+ delete
drop policy if exists "public read site content" on public.site_content;
create policy "public read site content" on public.site_content for select using (true);
drop policy if exists "admin write site content" on public.site_content;
drop policy if exists "staff insert site content" on public.site_content;
create policy "staff insert site content" on public.site_content for insert with check (public.is_staff());
drop policy if exists "staff update site content" on public.site_content;
create policy "staff update site content" on public.site_content for update using (public.is_staff());
drop policy if exists "admin delete site content" on public.site_content;
create policy "admin delete site content" on public.site_content for delete using (public.is_admin());

-- carts: owner only
drop policy if exists "own cart" on public.carts;
create policy "own cart" on public.carts for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- orders: customers create/view own; staff manage all; admin+ delete
drop policy if exists "own orders select" on public.orders;
create policy "own orders select" on public.orders for select using (user_id = auth.uid() or public.is_staff());
drop policy if exists "own orders insert" on public.orders;
create policy "own orders insert" on public.orders for insert with check (user_id = auth.uid());
drop policy if exists "admin orders update" on public.orders;
drop policy if exists "staff orders update" on public.orders;
create policy "staff orders update" on public.orders for update using (public.is_staff());
drop policy if exists "admin orders delete" on public.orders;
create policy "admin orders delete" on public.orders for delete using (public.is_admin());

-- messages: customers create/view own; staff manage; admin+ delete; guests may send via the contact form
drop policy if exists "own messages select" on public.customer_messages;
create policy "own messages select" on public.customer_messages for select using (user_id = auth.uid() or public.is_staff());
drop policy if exists "own messages insert" on public.customer_messages;
create policy "own messages insert" on public.customer_messages for insert with check (user_id = auth.uid());
drop policy if exists "admin messages manage" on public.customer_messages;
drop policy if exists "staff messages update" on public.customer_messages;
create policy "staff messages update" on public.customer_messages for update using (public.is_staff());
drop policy if exists "admin messages delete" on public.customer_messages;
create policy "admin messages delete" on public.customer_messages for delete using (public.is_admin());
drop policy if exists "anon message insert" on public.customer_messages;
create policy "anon message insert" on public.customer_messages for insert to anon with check (true);

-- transactions: staff+ read; only the server's service role writes (no client
-- insert/update policies on purpose - the ledger is append-only and tamper-proof)
drop policy if exists "admin read transactions" on public.transactions;
drop policy if exists "staff read transactions" on public.transactions;
create policy "staff read transactions" on public.transactions for select using (public.is_staff());

-- robo_car_modes: public read, staff edit, admin+ delete
drop policy if exists "public read robo_car_modes" on public.robo_car_modes;
create policy "public read robo_car_modes" on public.robo_car_modes for select using (true or public.is_staff());
drop policy if exists "admin write robo_car_modes" on public.robo_car_modes;
drop policy if exists "staff insert robo_car_modes" on public.robo_car_modes;
create policy "staff insert robo_car_modes" on public.robo_car_modes for insert with check (public.is_staff());
drop policy if exists "staff update robo_car_modes" on public.robo_car_modes;
create policy "staff update robo_car_modes" on public.robo_car_modes for update using (public.is_staff());
drop policy if exists "admin delete robo_car_modes" on public.robo_car_modes;
create policy "admin delete robo_car_modes" on public.robo_car_modes for delete using (public.is_admin());

-- ===== STORAGE: product image bucket =====
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "public read images" on storage.objects;
create policy "public read images" on storage.objects for select using (bucket_id = 'product-images');
-- drop BOTH names: early rounds created these as "admin *", later as "staff *"
-- (the create below uses the staff name — dropping both keeps db:apply re-runnable).
drop policy if exists "admin upload images" on storage.objects;
drop policy if exists "staff upload images" on storage.objects;
create policy "staff upload images" on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and public.is_staff());
drop policy if exists "admin update images" on storage.objects;
drop policy if exists "staff update images" on storage.objects;
create policy "staff update images" on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and public.is_staff());
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

-- seed the 9 original modes from the ESP32 firmware
insert into public.robo_car_modes (id, name, token, device_index, car, wheel, steering, sensors, transport, remote_with, controls, requires_connection, blurb, sort_order) values
  ('4wd4m', '4WD4M', '4WD4M', 0, '4-wheel-drive', '4 × BO/brushed motors', 'Skid-steer (differential)', '[]', '["ble","classic-bt"]', 'ESP REMOTE or app', '["drive-tank"]', true, 'A 4-motor drive car driven by direction (F/B/L/R) and speed.', 1),
  ('2wd1m', 'Bluetooth · 2WD + Servo (1M)', '2WD1M', 8, '2-wheel-drive', '1 × BO motor (rear)', '1 × servo (0..180, center 90)', '[]', '["ble","classic-bt"]', 'ESP REMOTE two-joystick', '["drive-2wd1m"]', true, 'One drive motor plus a steering servo. Speed is signed SPD (fwd +ve).', 2),
  ('self-balancing', 'Self-Balancing', 'AUTO', 6, 'Self-balancing', '2 × BO motors', 'Self-balance (PID)', '["MPU6050 IMU"]', '["ble","wifi","classic-bt"]', 'ESP REMOTE (PID tuning)', '["pid-auto"]', true, 'Balances itself in AUTO mode. The app/remote tune Kp/Ki/Kd OUT/OFF live.', 3),
  ('obstacle-us', 'Obstacle Avoidance · Ultrasonic', 'OBS_US', 3, 'Obstacle avoider', '2/4 × BO motors', 'Skid-steer', '["HC-SR04 / ultrasonic"]', '["ble","wifi","classic-bt"]', 'ESP REMOTE', '["start-stop"]', true, 'Runs autonomous obstacle avoidance using an ultrasonic sensor.', 4),
  ('obstacle-ir', 'Obstacle Avoidance · IR', 'OBS_IR', 4, 'Obstacle avoider', '2/4 × BO motors', 'Skid-steer', '["IR / photodiode pair"]', '["ble","wifi","classic-bt"]', 'ESP REMOTE', '["start-stop"]', true, 'Autonomous obstacle avoidance driven by IR sensors.', 5),
  ('website-client', 'Website Controlled · Client', 'ESP_CLI', 7, 'Website car', '2/4 × BO motors', 'Skid-steer', '[]', '["wifi"]', 'Browser / app', '["weblink"]', false, 'The ESP32 is a WiFi client; the browser/app acts as the control server.', 6),
  ('website-server', 'Website Controlled · Server', 'ESP_SER', 1, 'Website car', '2/4 × BO motors', 'Skid-steer', '[]', '["wifi"]', 'Browser / app', '["weblink"]', false, 'The ESP32 hosts its own web page; open its IP to drive it.', 7),
  ('path-follow', 'Path Following · IR', 'PATH', 2, 'Line follower', '2/4 × BO motors', 'Skid-steer', '["IR line sensors"]', '["ble","wifi","classic-bt"]', 'ESP REMOTE', '["start-stop"]', true, 'Follows an IR-detected line or path autonomously.', 8),
  ('rf-manual', 'Manual · RF', 'MAN', 5, 'RF car', '2/4 × BO motors', 'Skid-steer', '[]', '["rf"]', 'RF hand-held remote', '["drive-tank"]', false, 'Manual control over RF modules (not BT or WiFi) - drive with the RF handset.', 9)
on conflict (id) do nothing;

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

-- services: public read, staff edit, admin+ delete
drop policy if exists "public read services" on public.services;
create policy "public read services" on public.services for select using (active = true or public.is_staff());
drop policy if exists "admin write services" on public.services;
drop policy if exists "staff insert services" on public.services;
create policy "staff insert services" on public.services for insert with check (public.is_staff());
drop policy if exists "staff update services" on public.services;
create policy "staff update services" on public.services for update using (public.is_staff());
drop policy if exists "admin delete services" on public.services;
create policy "admin delete services" on public.services for delete using (public.is_admin());

-- activity_log: staff+ read; server writes via service role
drop policy if exists "admin read activity" on public.activity_log;
drop policy if exists "staff read activity" on public.activity_log;
create policy "staff read activity" on public.activity_log for select using (public.is_staff());

-- page_views: staff+ read; anon + authenticated insert allowed for tracking
-- (the app records views from signed-in users, so an authenticated insert
-- policy is required in addition to the website's anon one)
drop policy if exists "anon insert page views" on public.page_views;
create policy "anon insert page views" on public.page_views for insert to anon with check (true);
drop policy if exists "authenticated insert page views" on public.page_views;
create policy "authenticated insert page views" on public.page_views for insert to authenticated with check (true);
drop policy if exists "admin read page views" on public.page_views;
drop policy if exists "staff read page views" on public.page_views;
create policy "staff read page views" on public.page_views for select using (public.is_staff());

-- ===== PUSH TOKENS (in-app order status notifications) =====
-- One row per device: the app registers its Expo push token here on
-- sign-in and deletes it on sign-out. The push-order-status edge function
-- (supabase/functions/push-order-status) reads these with the service role
-- when an order status changes (see order-status-push-trigger.sql).
create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null,
  platform text not null default 'android',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, token)
);
create index if not exists push_tokens_user_idx on public.push_tokens(user_id);
alter table public.push_tokens enable row level security;

-- users manage only their own device tokens (edge function uses service role)
drop policy if exists "own push tokens select" on public.push_tokens;
create policy "own push tokens select" on public.push_tokens for select using (user_id = auth.uid());
drop policy if exists "own push tokens insert" on public.push_tokens;
create policy "own push tokens insert" on public.push_tokens for insert with check (user_id = auth.uid());
drop policy if exists "own push tokens update" on public.push_tokens;
create policy "own push tokens update" on public.push_tokens for update using (user_id = auth.uid());
drop policy if exists "own push tokens delete" on public.push_tokens;
create policy "own push tokens delete" on public.push_tokens for delete using (user_id = auth.uid());

-- ===== WEB PUSH SUBSCRIPTIONS (W-3 — browser push, NO Firebase) =====
-- One row per browser subscription: endpoint + the ECDH/subscription keys
-- the Web Push protocol needs. The app uses Expo tokens (push_tokens above,
-- dormant until Firebase is activated); the website uses standards-based
-- Web Push (VAPID) — different transports, one delivery story, all through
-- Supabase. The push-order-status edge function sends to BOTH.
create table if not exists public.web_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, endpoint)
);
create index if not exists web_push_subscriptions_user_idx on public.web_push_subscriptions(user_id);
create index if not exists web_push_subscriptions_endpoint_idx on public.web_push_subscriptions(endpoint);
alter table public.web_push_subscriptions enable row level security;

-- users manage only their own subscriptions (edge function uses service role)
drop policy if exists "own web push select" on public.web_push_subscriptions;
create policy "own web push select" on public.web_push_subscriptions for select using (user_id = auth.uid());
drop policy if exists "own web push insert" on public.web_push_subscriptions;
create policy "own web push insert" on public.web_push_subscriptions for insert with check (user_id = auth.uid());
drop policy if exists "own web push update" on public.web_push_subscriptions;
create policy "own web push update" on public.web_push_subscriptions for update using (user_id = auth.uid());
drop policy if exists "own web push delete" on public.web_push_subscriptions;
create policy "own web push delete" on public.web_push_subscriptions for delete using (user_id = auth.uid());

-- ===== USER SETTINGS (per-user preferences shared by app + web) =====
-- One JSONB blob per user for arbitrary customization: command keywords,
-- UI options, notification choices, etc. The theme preference stays on
-- profiles.theme_preference (single flat column both clients read);
-- everything else lands here so future features never need a migration
-- per preference. Clients read/write ONLY their own row via RLS.
create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.user_settings enable row level security;

drop policy if exists "own user settings select" on public.user_settings;
create policy "own user settings select" on public.user_settings for select using (user_id = auth.uid());
drop policy if exists "own user settings insert" on public.user_settings;
create policy "own user settings insert" on public.user_settings for insert with check (user_id = auth.uid());
drop policy if exists "own user settings update" on public.user_settings;
create policy "own user settings update" on public.user_settings for update using (user_id = auth.uid());
drop policy if exists "own user settings delete" on public.user_settings;
create policy "own user settings delete" on public.user_settings for delete using (user_id = auth.uid());

-- ===== JOURNAL POSTS =====
-- Public blog/journal content shown identically on the website and the
-- native app. The bundled lib/journal-data.ts is only a fallback + seed.
create table if not exists public.journal_posts (
  id text primary key,
  tag text not null default '',
  title text not null,
  text text not null,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.journal_posts enable row level security;

drop policy if exists "public read journal posts" on public.journal_posts;
create policy "public read journal posts" on public.journal_posts
  for select using (active = true or public.is_staff());

drop policy if exists "admin write journal posts" on public.journal_posts;
drop policy if exists "staff insert journal posts" on public.journal_posts;
create policy "staff insert journal posts" on public.journal_posts
  for insert with check (public.is_staff());
drop policy if exists "staff update journal posts" on public.journal_posts;
create policy "staff update journal posts" on public.journal_posts
  for update using (public.is_staff());
drop policy if exists "admin delete journal posts" on public.journal_posts;
create policy "admin delete journal posts" on public.journal_posts
  for delete using (public.is_admin());

-- ===== TRAINING PROGRAMS / PILOT COSTS / CURRICULUM HIGHLIGHTS =====
-- Public content shown identically on the website and the native app.
-- Bundled lib/programs-data.ts is only a fallback + seed source.
create table if not exists public.training_programs (
  id text primary key,
  title text not null,
  audience text not null default '',
  description text not null default '',
  duration text not null default '',
  outcome text not null default '',
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.training_programs enable row level security;

drop policy if exists "public read training programs" on public.training_programs;
create policy "public read training programs" on public.training_programs
  for select using (active = true or public.is_staff());

drop policy if exists "admin write training programs" on public.training_programs;
drop policy if exists "staff insert training programs" on public.training_programs;
create policy "staff insert training programs" on public.training_programs
  for insert with check (public.is_staff());
drop policy if exists "staff update training programs" on public.training_programs;
create policy "staff update training programs" on public.training_programs
  for update using (public.is_staff());
drop policy if exists "admin delete training programs" on public.training_programs;
create policy "admin delete training programs" on public.training_programs
  for delete using (public.is_admin());

create table if not exists public.pilot_cost_lines (
  id text primary key,
  item text not null,
  cost text not null default '',
  note text not null default '',
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.pilot_cost_lines enable row level security;

drop policy if exists "public read pilot cost lines" on public.pilot_cost_lines;
create policy "public read pilot cost lines" on public.pilot_cost_lines
  for select using (active = true or public.is_staff());

drop policy if exists "admin write pilot cost lines" on public.pilot_cost_lines;
drop policy if exists "staff insert pilot cost lines" on public.pilot_cost_lines;
create policy "staff insert pilot cost lines" on public.pilot_cost_lines
  for insert with check (public.is_staff());
drop policy if exists "staff update pilot cost lines" on public.pilot_cost_lines;
create policy "staff update pilot cost lines" on public.pilot_cost_lines
  for update using (public.is_staff());
drop policy if exists "admin delete pilot cost lines" on public.pilot_cost_lines;
create policy "admin delete pilot cost lines" on public.pilot_cost_lines
  for delete using (public.is_admin());

create table if not exists public.curriculum_highlights (
  id text primary key,
  age_band text not null,
  items jsonb not null default '[]',
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.curriculum_highlights enable row level security;

drop policy if exists "public read curriculum highlights" on public.curriculum_highlights;
create policy "public read curriculum highlights" on public.curriculum_highlights
  for select using (active = true or public.is_staff());

drop policy if exists "admin write curriculum highlights" on public.curriculum_highlights;
drop policy if exists "staff insert curriculum highlights" on public.curriculum_highlights;
create policy "staff insert curriculum highlights" on public.curriculum_highlights
  for insert with check (public.is_staff());
drop policy if exists "staff update curriculum highlights" on public.curriculum_highlights;
create policy "staff update curriculum highlights" on public.curriculum_highlights
  for update using (public.is_staff());
drop policy if exists "admin delete curriculum highlights" on public.curriculum_highlights;
create policy "admin delete curriculum highlights" on public.curriculum_highlights
  for delete using (public.is_admin());

-- ===== COMPANY INFO =====
-- Single public row with the business contact/brand details shown on the
-- website and the native app. Bundled lib/company.ts is only a fallback +
-- seed source. url stays env-derived (NEXT_PUBLIC_SITE_URL) and is not stored.
create table if not exists public.company_info (
  id integer primary key default 1 check (id = 1),
  name text not null default '',
  short_name text not null default '',
  address text not null default '',
  city text not null default '',
  country text not null default '',
  email text not null default '',
  phone text not null default '',
  pan text not null default '',
  vat_label text not null default '',
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.company_info enable row level security;

drop policy if exists "public read company info" on public.company_info;
create policy "public read company info" on public.company_info
  for select using (true);

drop policy if exists "admin write company info" on public.company_info;
drop policy if exists "staff insert company info" on public.company_info;
create policy "staff insert company info" on public.company_info
  for insert with check (public.is_staff());
drop policy if exists "staff update company info" on public.company_info;
create policy "staff update company info" on public.company_info
  for update using (public.is_staff());
drop policy if exists "admin delete company info" on public.company_info;
create policy "admin delete company info" on public.company_info
  for delete using (public.is_admin());

-- Set the sole owner account (2026-09-22). Only this account may delete users.
-- The profile may already exist from the signup trigger; upsert to force role='owner'.
do $$
declare
  owner_id uuid;
begin
  select id into owner_id from auth.users where email = 'genumsolutions@gmail.com';
  if owner_id is not null then
    insert into public.profiles (id, name, role)
    values (owner_id, coalesce((select split_part(email, '@', 1) from auth.users where id = owner_id), 'genumsolutions'), 'owner')
    on conflict (id) do update set role = 'owner';
  end if;
end $$;

-- Project categories (shared): 'robocar', 'home-automation', etc.
create table if not exists public.project_categories (
  id text primary key,                  -- 'robocar', 'home-automation', etc.
  name text not null,                   -- 'Robo Car', 'Home Automation', etc.
  icon text not null default 'cpu',     -- Feather icon name
  car_type text,                        -- default carType for this category (e.g. '4wd4m')
  hardware jsonb not null default '[]', -- [{ name, role }]
  capabilities jsonb not null default '[]', -- ['directional', 'servo', etc.]
  capability_labels jsonb not null default '{}', -- { "directional": "Directional drive" }
  capability_notes jsonb not null default '{}',  -- { "directional": "Moves forward/backward..." }
  car_mode_ids jsonb not null default '[]',      -- ['4wd4m', '2wd1m'] — linked car modes
  sort_order integer not null default 1000,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.project_categories enable row level security;

drop policy if exists "public read project_categories" on public.project_categories;
create policy "public read project_categories" on public.project_categories
  for select using (true);

drop policy if exists "admin write project_categories" on public.project_categories;
drop policy if exists "staff insert project_categories" on public.project_categories;
create policy "staff insert project_categories" on public.project_categories
  for insert with check (public.is_staff());
drop policy if exists "staff update project_categories" on public.project_categories;
create policy "staff update project_categories" on public.project_categories
  for update using (public.is_staff());
drop policy if exists "admin delete project_categories" on public.project_categories;
create policy "admin delete project_categories" on public.project_categories
  for delete using (public.is_admin());

-- Seed the 5 controller categories (idempotent)
insert into public.project_categories (id, name, icon, car_type, hardware, capabilities, capability_labels, capability_notes, car_mode_ids, sort_order) values
('robocar', 'Robo Car', 'cpu', '4wd4m',
  '[{"name":"ESP32","role":"controller"},{"name":"L298N","role":"motor driver"},{"name":"BO motors","role":"drive"},{"name":"MPU6050","role":"IMU (self-balance)"}]',
  '["directional","servo","pid","start-stop","weblink","slider"]',
  '{"directional":"Directional drive","servo":"Servo steering","pid":"PID self-balance","start-stop":"Start/stop control","weblink":"Web link control","slider":"Speed slider"}',
  '{"directional":"Move forward/backward/left/right with speed control","servo":"Control steering servo angle (0-180)","pid":"Self-balancing with Kp/Ki/Kd tuning","start-stop":"Start and stop motors remotely","weblink":"Control via web browser over WiFi","slider":"Adjust speed with slider control"}',
  '["4wd4m","2wd1m","self-balancing","obstacle-us","obstacle-ir","path-follow","rf-manual","website-client","website-server"]',
  1)
on conflict (id) do update set
  name = excluded.name, icon = excluded.icon, car_type = excluded.car_type,
  hardware = excluded.hardware, capabilities = excluded.capabilities,
  capability_labels = excluded.capability_labels, capability_notes = excluded.capability_notes,
  car_mode_ids = excluded.car_mode_ids, sort_order = excluded.sort_order, updated_at = now();

insert into public.project_categories (id, name, icon, car_type, hardware, capabilities, capability_labels, capability_notes, car_mode_ids, sort_order) values
('home-automation', 'Home Automation', 'home', null,
  '[{"name":"ESP32","role":"controller"},{"name":"Relay module","role":"switch"},{"name":"Sensors","role":"monitoring"}]',
  '["relay","sensor","slider"]',
  '{"relay":"Relay control","sensor":"Sensor monitoring","slider":"Dimmer slider"}',
  '{"relay":"Switch devices on/off remotely","sensor":"Read temperature, humidity, light levels","slider":"Adjust brightness or fan speed"}',
  '[]',
  2)
on conflict (id) do update set
  name = excluded.name, icon = excluded.icon, car_type = excluded.car_type,
  hardware = excluded.hardware, capabilities = excluded.capabilities,
  capability_labels = excluded.capability_labels, capability_notes = excluded.capability_notes,
  car_mode_ids = excluded.car_mode_ids, sort_order = excluded.sort_order, updated_at = now();

insert into public.project_categories (id, name, icon, car_type, hardware, capabilities, capability_labels, capability_notes, car_mode_ids, sort_order) values
('smart-farm', 'Smart Farm', 'leaf', null,
  '[{"name":"ESP32","role":"controller"},{"name":"Soil moisture sensor","role":"monitoring"},{"name":"Water pump","role":"actuator"},{"name":"Relay","role":"switch"}]',
  '["relay","sensor","slider"]',
  '{"relay":"Pump control","sensor":"Soil monitoring","slider":"Threshold adjust"}',
  '{"relay":"Turn water pump on/off","sensor":"Read soil moisture and temperature","slider":"Adjust irrigation thresholds"}',
  '[]',
  3)
on conflict (id) do update set
  name = excluded.name, icon = excluded.icon, car_type = excluded.car_type,
  hardware = excluded.hardware, capabilities = excluded.capabilities,
  capability_labels = excluded.capability_labels, capability_notes = excluded.capability_notes,
  car_mode_ids = excluded.car_mode_ids, sort_order = excluded.sort_order, updated_at = now();

insert into public.project_categories (id, name, icon, car_type, hardware, capabilities, capability_labels, capability_notes, car_mode_ids, sort_order) values
('smart-city', 'Smart City', 'building', null,
  '[{"name":"ESP32","role":"controller"},{"name":"Traffic lights","role":"display"},{"name":"Sensors","role":"monitoring"},{"name":"Relay","role":"switch"}]',
  '["relay","sensor","slider"]',
  '{"relay":"Light control","sensor":"Traffic monitoring","slider":"Timer adjust"}',
  '{"relay":"Control street lights and signals","sensor":"Monitor traffic and air quality","slider":"Adjust timing and thresholds"}',
  '[]',
  4)
on conflict (id) do update set
  name = excluded.name, icon = excluded.icon, car_type = excluded.car_type,
  hardware = excluded.hardware, capabilities = excluded.capabilities,
  capability_labels = excluded.capability_labels, capability_notes = excluded.capability_notes,
  car_mode_ids = excluded.car_mode_ids, sort_order = excluded.sort_order, updated_at = now();

insert into public.project_categories (id, name, icon, car_type, hardware, capabilities, capability_labels, capability_notes, car_mode_ids, sort_order) values
('drones', 'Drones & Aerial', 'wind', 'drone',
  '[{"name":"ESP32","role":"controller"},{"name":"Brushless motors","role":"propulsion"},{"name":"ESC","role":"speed control"},{"name":"MPU6050","role":"IMU"},{"name":"GPS","role":"navigation"}]',
  '["sensor","slider","gimbal","altitude"]',
  '{"sensor":"Telemetry","slider":"Throttle","gimbal":"Camera gimbal","altitude":"Altitude hold"}',
  '{"sensor":"Read flight telemetry (altitude, battery, GPS)","slider":"Adjust throttle and yaw","gimbal":"Pan and tilt camera","altitude":"Maintain altitude automatically"}',
  '[]',
  5)
on conflict (id) do update set
  name = excluded.name, icon = excluded.icon, car_type = excluded.car_type,
  hardware = excluded.hardware, capabilities = excluded.capabilities,
  capability_labels = excluded.capability_labels, capability_notes = excluded.capability_notes,
  car_mode_ids = excluded.car_mode_ids, sort_order = excluded.sort_order, updated_at = now();

-- ===== CAR MODE ID ON PRODUCTS =====
-- Replaces fragile badge-based product-to-mode resolution with a DB foreign key.
alter table public.products add column if not exists car_mode_id text references public.robo_car_modes(id);

-- Seed car_mode_id for existing robot car products based on their badge
update public.products set car_mode_id = '4wd4m' where id = '4wd4m-basic';
update public.products set car_mode_id = '2wd1m' where id = '2wd1m-basic';
update public.products set car_mode_id = 'self-balancing' where id = 'self-balancing-basic';
update public.products set car_mode_id = 'obstacle-us' where id = 'obstacle-us-basic';
update public.products set car_mode_id = 'obstacle-ir' where id = 'obstacle-ir-basic';
update public.products set car_mode_id = 'website-client' where id = 'website-client-basic';
update public.products set car_mode_id = 'website-server' where id = 'website-server-basic';
update public.products set car_mode_id = 'path-follow' where id = 'path-follow-basic';
update public.products set car_mode_id = 'rf-manual' where id = 'rf-manual-basic';

-- Fix drone products: move from 'Pre-packaged Kits' to 'Drones & Aerial'
-- so they map to the 'drones' controller category instead of 'robocar'.
update public.products set category = 'Drones & Aerial'
where category = 'Pre-packaged Kits'
  and (name ilike '%drone%' or name ilike '%quadcopter%' or name ilike '%aerial%');

-- ===== USER TIER (free/pro) — 2026-09-22 =====
-- Pro users unlock the app's Remote window and the per-robot preference
-- store below. Managed ONLY by admins (website admin panel / service role);
-- a customer can never promote themselves, mirroring protect_role_column.
alter table public.profiles add column if not exists tier text not null default 'free';
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_tier_check'
  ) then
    alter table public.profiles
      add constraint profiles_tier_check check (tier in ('free','pro'));
  end if;
end $$;

create or replace function public.protect_tier_column()
returns trigger security definer set search_path = public as $$
begin
  if new.tier is distinct from old.tier
     and current_setting('role') not in ('postgres', 'service_role', 'supabase_admin') then
    raise exception 'Only administrators can change the tier.';
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists profiles_protect_tier on public.profiles;
create trigger profiles_protect_tier
before update on public.profiles
for each row execute function public.protect_tier_column();

-- ===== ROBOT USER SETTINGS (per-pro-user robot preferences) =====
-- One row per (user, robot). COMPLETELY SEPARATE from carts/orders — this is
-- the user's own engineering profile for each robot/project: command code
-- values, tuning parameters, and which telemetry channels they want mirrored.
-- The app edits its own rows through RLS; admins reach every row through the
-- website admin panel (service role) so nothing is ever untracked per user.
create table if not exists public.robot_user_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  robot_id text not null,
  robot_name text not null default '',
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, robot_id)
);

create index if not exists robot_user_settings_user_idx on public.robot_user_settings (user_id);
create index if not exists robot_user_settings_robot_idx on public.robot_user_settings (robot_id);

-- Keep updated_at truthful on every write.
create or replace function public.touch_robot_user_settings()
returns trigger set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists robot_user_settings_touch on public.robot_user_settings;
create trigger robot_user_settings_touch
before update on public.robot_user_settings
for each row execute function public.touch_robot_user_settings();

-- RLS: the owner does everything with their own rows; admins (role='admin'
-- in profiles) read/write every row so the admin panel can manage them all.
alter table public.robot_user_settings enable row level security;

drop policy if exists "robot_user_settings_select_own" on public.robot_user_settings;
create policy "robot_user_settings_select_own" on public.robot_user_settings
for select using (
  auth.uid() = user_id
  or public.is_staff()
);

drop policy if exists "robot_user_settings_insert_own" on public.robot_user_settings;
create policy "robot_user_settings_insert_own" on public.robot_user_settings
for insert with check (auth.uid() = user_id);

drop policy if exists "robot_user_settings_update_own" on public.robot_user_settings;
create policy "robot_user_settings_update_own" on public.robot_user_settings
for update using (
  auth.uid() = user_id
  or public.is_staff()
);

drop policy if exists "robot_user_settings_delete_own" on public.robot_user_settings;
create policy "robot_user_settings_delete_own" on public.robot_user_settings
for delete using (
  auth.uid() = user_id
  or public.is_admin()
);

-- ===== USER LAST-SEEN (admin visibility parity, app <-> website) =====
-- The website Users tab shows "Last seen" from auth.users.last_sign_in_at
-- (service role). The app's anon key cannot read auth.users, so the app
-- Users tab had no equivalent field. This SECURITY DEFINER function lets
-- signed-in ADMINS read any user's last sign-in timestamp while keeping
-- auth data closed to everyone else (owner-confirmed parity requirement:
-- "not even a tiny detail").
create or replace function public.admin_user_last_seen(target_user_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  caller_role text;
  last_seen timestamptz;
begin
  select role into caller_role from public.profiles where id = auth.uid();
  if caller_role is null or caller_role not in ('staff','admin','owner') then
    return null;
  end if;
  select last_sign_in_at into last_seen from auth.users where id = target_user_id;
  return last_seen;
end;
$$;

comment on function public.admin_user_last_seen(uuid) is
  'Returns auth.users.last_sign_in_at for the target user when the caller has staff+ (staff/admin/owner) privileges, else null. Parity shim for the app Users tab.';

-- ===== STOCK DECREMENT / RESTORE (C1, 2026-09-23) =====
-- Stock leaves the shelf at the moment an order is PAID (never at creation:
-- pending orders that are abandoned must not hold stock back forever) and
-- comes back when a PAID order is cancelled.
--
-- mark_order_paid is the single atomic pay transition used by the website
-- confirm routes, the app payment edge functions, and the webhook: it locks
-- the order row (FOR UPDATE), no-ops when the order is already
-- paid/fulfilled (gateway webhook + redirect race), decrements the order's
-- items, and flips status -> paid in the same transaction. Returns true
-- only for the call that actually performed the transition.
--
-- restore_order_stock restores a paid/fulfilled order's items. The caller
-- passes the pre-status it read (expect_status); the row is locked and the
-- status re-checked inside the function, so a concurrent status change
-- makes the restore a no-op (no double restore).
--
-- Both are SECURITY DEFINER, callable by the service role (server routes /
-- edge functions) and staff+ for manual fixes. Decrements clamp at zero and
-- skip rows already at 0 (hardware realities beat ledger purity).
create or replace function public.adjust_order_stock(order_items jsonb, direction text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  line jsonb;
  pid text;
  qty integer;
  delta integer;
  changed integer := 0;
begin
  -- service role bypasses RLS but has no auth.uid(); staff+ pass via profile.
  if auth.uid() is not null and not public.is_staff() then
    raise exception 'adjust_order_stock: staff privileges required';
  end if;
  if direction not in ('decrement', 'restore') then
    raise exception 'adjust_order_stock: direction must be decrement or restore';
  end if;

  if order_items is null or jsonb_typeof(order_items) <> 'array' then
    return 0;
  end if;

  for line in select * from jsonb_array_elements(order_items)
  loop
    pid := line->>'productId';
    qty := coalesce((line->>'quantity')::int, 0);
    continue when pid is null or qty is null or qty <= 0;

    delta := case when direction = 'decrement' then -qty else qty end;
    update public.products
       set stock = greatest(0, stock + delta),
           updated_at = now()
     where id = pid
       and (direction = 'restore' or stock > 0);
    if found then
      changed := changed + 1;
    end if;
  end loop;
  return changed;
end;
$$;

comment on function public.adjust_order_stock(jsonb, text) is
  'C1 stock engine: decrement/restore products.stock for an order''s items jsonb. SECURITY DEFINER, service-role or staff+ only. Restores are unbounded; decrements clamp at zero (and skip rows already at 0).';

revoke all on function public.adjust_order_stock(jsonb, text) from public;
revoke all on function public.adjust_order_stock(jsonb, text) from anon;
grant execute on function public.adjust_order_stock(jsonb, text) to service_role;
grant execute on function public.adjust_order_stock(jsonb, text) to authenticated;

-- Atomic pay transition: decrement stock + flip status -> paid, row-locked.
-- NOTE: the second parameter MUST stay named provider_ref (callers pass it as
-- a named RPC arg). The column/param name collision inside the UPDATE is
-- resolved with the new_ref variable, NOT by renaming the parameter
-- (create or replace cannot rename parameters anyway).
create or replace function public.mark_order_paid(order_id uuid, provider_ref text default '')
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  ord public.orders%rowtype;
  new_ref text := nullif(provider_ref, '');
begin
  if auth.uid() is not null and not public.is_staff() then
    raise exception 'mark_order_paid: staff privileges required';
  end if;
  select * into ord from public.orders where id = order_id for update;
  if not found then
    return false;
  end if;
  if ord.status in ('paid', 'fulfilled') then
    return false; -- already paid: webhook + confirm-route race, stock intact
  end if;
  perform public.adjust_order_stock(ord.items, 'decrement');
  update public.orders
     set status = 'paid',
         provider_ref = coalesce(new_ref, ord.provider_ref),
         updated_at = now()
   where id = order_id;
  return true;
end;
$$;

comment on function public.mark_order_paid(uuid, text) is
  'C1: atomically marks an order paid and decrements its items'' stock. Row-locked and idempotent (false when already paid/fulfilled). SECURITY DEFINER, service-role or staff+ only.';

revoke all on function public.mark_order_paid(uuid, text) from public;
revoke all on function public.mark_order_paid(uuid, text) from anon;
grant execute on function public.mark_order_paid(uuid, text) to service_role;
grant execute on function public.mark_order_paid(uuid, text) to authenticated;



-- Restore stock for a paid/fulfilled order being cancelled. Guarded on the
-- caller's observed pre-status + a row lock, so concurrent admins cannot
-- double-restore. The guarded transition is ATOMIC: stock restore + status
-- flip to 'cancelled' happen in the same locked transaction, so a retry
-- (or a crashed caller between restore and its own status update) can
-- never restore twice.
create or replace function public.restore_order_stock(order_id uuid, expect_status text default 'paid')
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  ord public.orders%rowtype;
  changed integer := 0;
begin
  if auth.uid() is not null and not public.is_staff() then
    raise exception 'restore_order_stock: staff privileges required';
  end if;
  if expect_status not in ('paid', 'fulfilled') then
    return 0; -- nothing was ever decremented for pending orders
  end if;
  select * into ord from public.orders where id = order_id for update;
  if not found or ord.status <> expect_status then
    return 0; -- already restored / never paid / concurrently changed
  end if;
  changed := public.adjust_order_stock(ord.items, 'restore');
  update public.orders
     set status = 'cancelled',
         updated_at = now()
   where id = order_id;
  return changed;
end;
$$;

comment on function public.restore_order_stock(uuid, text) is
  'C1: atomically restores products.stock for a paid/fulfilled order and flips it to cancelled. No-ops unless the row is still in expect_status (row-locked, idempotent). SECURITY DEFINER, service-role or staff+ only.';

revoke all on function public.restore_order_stock(uuid, text) from public;
revoke all on function public.restore_order_stock(uuid, text) from anon;
grant execute on function public.restore_order_stock(uuid, text) to service_role;
grant execute on function public.restore_order_stock(uuid, text) to authenticated;

