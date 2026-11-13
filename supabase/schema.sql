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

-- auto-create a profile whenever someone signs up; the main account
-- (genumsolutions@gmail.com) is created as owner on its very first signup,
-- so admin access never depends on running the owner block below.
create or replace function public.handle_new_user()
returns trigger security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    case when lower(new.email) = 'genumsolutions@gmail.com' then 'owner' else 'customer' end
  );
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

-- The owner account is permanent (owner request, 2026-11-12): no client, no
-- edge function and no SQL session may delete it, so the single owner can
-- never be removed by accident. Matches lib/roles.ts OWNER_EMAIL.
create or replace function public.protect_owner_account()
returns trigger security definer set search_path = public as $$
begin
  if lower(old.email) = 'genumsolutions@gmail.com' then
    raise exception 'The owner account cannot be deleted.';
  end if;
  return old;
end;
$$ language plpgsql;

drop trigger if exists protect_owner_account on auth.users;
create trigger protect_owner_account
before delete on auth.users
for each row execute function public.protect_owner_account();

-- Google registration is allowed (revised 2026-11-12). The earlier
-- "sign-in only" guard (block_new_google_account) refused every brand-new
-- Google row, so "Register with Google" failed with the same "no account"
-- message a failed sign-in gives - indistinguishable from an outage. Google
-- is now a first-class registration path (an id-token/OAuth row arrives with
-- email_verified = true, so it needs no confirmation email); email/password
-- registration still requires confirmation. Drop the old guard here so a
-- re-provision of an existing database converges on the same behaviour.
drop trigger if exists block_new_google_account on auth.users;
drop function if exists public.block_new_google_account();

-- ===== PRODUCTS =====
create table if not exists public.products (
  id text primary key,
  name text not null,
  category text not null,
  project_category text,
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
  gallery text[] not null default '{}',
  import_meta jsonb not null default '{}'::jsonb,
  sort_order integer not null default 1000,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.products add column if not exists gallery text[] not null default '{}';
alter table public.products add column if not exists import_meta jsonb not null default '{}'::jsonb;
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
alter table public.products add column if not exists project_category text;
create index if not exists products_category_idx on public.products(category);
create index if not exists products_project_category_idx on public.products(project_category);

-- ===== PROJECT CATEGORY ROWS (owner decision 2026-09-25, U-36) =====
-- Remote Controller and Smart Dustbin are the two single-item project
-- categories alongside Robo Car. Inserted here so the website's
-- project_categories store can read all 7 categories from the DB.
insert into public.project_categories (id, name, icon, car_type, hardware, capabilities, capability_labels, capability_notes, car_mode_ids, sort_order) values
('remote-controller', 'Remote Controller', 'radio', null,
  '[{"name":"ESP32","role":"controller"},{"name":"NRF24L01","role":"radio"},{"name":"Joystick module","role":"input"}]',
  '["relay","sensor","slider"]',
  '{"relay":"Channel switch","sensor":"Battery & signal readout","slider":"Throttle / steer curve"}',
  '{"relay":"Toggle output channels","sensor":"Read battery voltage and RSSI","slider":"Adjust throttle curve or steering trim"}',
  '[]',
  6)
on conflict (id) do update set
  name = excluded.name, icon = excluded.icon, car_type = excluded.car_type,
  hardware = excluded.hardware, capabilities = excluded.capabilities,
  capability_labels = excluded.capability_labels, capability_notes = excluded.capability_notes,
  car_mode_ids = excluded.car_mode_ids, sort_order = excluded.sort_order, updated_at = now();

insert into public.project_categories (id, name, icon, car_type, hardware, capabilities, capability_labels, capability_notes, car_mode_ids, sort_order) values
('smart-dustbin', 'Smart Dustbin', 'broom', null,
  '[{"name":"ESP32","role":"controller"},{"name":"Ultrasonic sensor","role":"debris detection"},{"name":"Servo","role":"lid actuator"},{"name":"Relay","role":"compactor switch"}]',
  '["relay","sensor","slider"]',
  '{"relay":"Compactor motor","sensor":"Debris level","slider":"Emptying schedule"}',
  '{"relay":"Drive the compactor motor on/off","sensor":"Report bin fill level","slider":"Set the auto-empty interval"}',
  '[]',
  7)
on conflict (id) do update set
  name = excluded.name, icon = excluded.icon, car_type = excluded.car_type,
  hardware = excluded.hardware, capabilities = excluded.capabilities,
  capability_labels = excluded.capability_labels, capability_notes = excluded.capability_notes,
  car_mode_ids = excluded.car_mode_ids, sort_order = excluded.sort_order, updated_at = now();

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
  select lower(coalesce(auth.jwt() ->> 'email', '')) = 'genumsolutions@gmail.com'
      or exists (select 1 from public.profiles where id = auth.uid() and role in ('staff','admin','owner'));
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = 'genumsolutions@gmail.com'
      or exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','owner'));
$$;

create or replace function public.is_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = 'genumsolutions@gmail.com'
      or exists (select 1 from public.profiles where id = auth.uid() and role = 'owner');
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
  ('4wd4m', '4WD4M', '4WD4M', 0, '4-Wheel Drive', '4 × BO/brushed motors', 'Skid-steer (differential)', '[]', '["classic-bt","wifi"]', 'ESP REMOTE or app', '["drive-tank"]', true, 'A 4-motor drive car driven by direction (F/B/L/R) and speed.', 1),
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

-- ===== NEWSLETTER SUBSCRIBERS (C4, 2026-09-23) =====
-- Public opt-in list captured from the website footer and checkout. Email is
-- the identity (unique, lowercase-normalized by the API before insert);
-- `source` records which surface captured it ('footer' | 'checkout').
-- Anon visitors can INSERT only (capturing themselves); everything else is
-- staff+ via RLS, and the admin list reads through the service role.
create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  source text not null default 'footer',
  status text not null default 'subscribed',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists newsletter_subscribers_created_idx on public.newsletter_subscribers(created_at);
alter table public.newsletter_subscribers enable row level security;

-- anyone may add themselves; one email = one row (unique index is the dedupe)
drop policy if exists "public insert newsletter" on public.newsletter_subscribers;
create policy "public insert newsletter" on public.newsletter_subscribers
  for insert with check (true);

-- reads and any mutation beyond the self-insert are staff-only
drop policy if exists "staff read newsletter" on public.newsletter_subscribers;
create policy "staff read newsletter" on public.newsletter_subscribers
  for select using (public.is_staff());
drop policy if exists "staff update newsletter" on public.newsletter_subscribers;
create policy "staff update newsletter" on public.newsletter_subscribers
  for update using (public.is_staff());
drop policy if exists "admin delete newsletter" on public.newsletter_subscribers;
create policy "admin delete newsletter" on public.newsletter_subscribers
  for delete using (public.is_admin());

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
  -- C5 (2026-09-23): socials + WhatsApp, admin-editable in Settings.
  -- whatsapp_number: digits with country code, no '+' (e.g. '9779861842552')
  -- so wa.me links build directly; social URLs may stay '' (row hidden).
  whatsapp_number text not null default '',
  facebook_url text not null default '',
  instagram_url text not null default '',
  tiktok_url text not null default '',
  linkedin_url text not null default '',
  youtube_url text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- C5 idempotence: older deployed rows predate the social columns.
alter table public.company_info add column if not exists whatsapp_number text not null default '';
alter table public.company_info add column if not exists facebook_url text not null default '';
alter table public.company_info add column if not exists instagram_url text not null default '';
alter table public.company_info add column if not exists tiktok_url text not null default '';
alter table public.company_info add column if not exists linkedin_url text not null default '';
alter table public.company_info add column if not exists youtube_url text not null default '';

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

-- ===== PROJECT CATEGORY (owner decision 2026-09-25, U-36) =====
-- project_category is the project-specific classification (separate
-- from category which keeps all 5 packages in "Robot Cars" so the
-- /products components scope still excludes them).
update public.products set project_category = 'Robo Car' where id in ('2wd1m-basic', '4wd4m-basic', 'self-balancing-basic');
update public.products set project_category = 'Remote Controller' where id = 'esp32-remote';
update public.products set project_category = 'Smart Dustbin' where id = 'smart-dustbin';

-- ===== PROJECT ROWS RESTORE (owner decision 2026-09-24, P4) =====
-- The U-13 inventory rewrite dropped all 'Project package' rows. Re-add ONLY
-- the 5 workspace-root firmware projects (Genum_* folders, completed in code).
-- Idempotent: re-running refreshes the rows and re-applies car_mode_id.
insert into public.products (
  id, name, category, product_type, inventory_type, price, price_label, stock,
  description, note, source_folder, estimated_duration, project_overview,
  objectives, materials_required, learning_outcomes, build_steps, control_methods,
  prerequisites, deliverables, car_mode_id, sort_order
) values
(
  '4wd4m-basic',
  'Wireless 4WD Car',
  'Robot Cars', 'Project package', 'Catalog', 0, 'Request quote', 0,
  'Modular ESP32 4WD car. Bluetooth-SPP drive (4WD4M) plus a WiFi web-server + app drive (ESP_SER), an SH1106 OLED dashboard and a failsafe that stops the motors after 2 s of command silence. Wi-Fi provisioning happens over Bluetooth (WIFICFG).',
  '4WD car driven by the GENUM app, website or the car-served web page.',
  'Genum_WIRELESS_CAR', '2–3 hours',
  'A complete 4WD robot-car platform built on the ESP32: Bluetooth SPP drive, a car-hosted responsive web page for WiFi drive, an OLED status dashboard, a 9-mode fleet registry and NVS-persisted Wi-Fi credentials.',
  '["Bluetooth-serial drive (4WD4M)","WiFi web-server + app drive (ESP_SER)","Wi-Fi provisioning over Bluetooth","Automatic AP fallback (WirelessCar_Wifi)","Failsafe motor stop after 2 s of command silence"]',
  '["ESP32 Dev Module","L298N motor driver","4 × BO/brushed motors","1.3 inch SH1106 OLED (I2C)","Li-ion battery pack"]',
  '["Skid-steer (differential) drive kinematics","ESP32 Bluetooth + WiFi coexistence","WebSockets server + static web page","NVS persistence (mode, speed, router list)","Failsafe and watchdog design"]',
  '["Wire the L298N, OLED and mode switch per Config.h","Build with arduino-cli (PartitionScheme=huge_app required)","Flash at 115200 baud and pair via Bluetooth","Drive from the app (4WD4M) or the car web page (ESP_SER)","Provision Wi-Fi over Bluetooth (WIFICFG) for networking"]',
  '["Bluetooth SPP app (4WD4M)","Car-hosted web page + WebSockets (ESP_SER)"]',
  '["Arduino Core for ESP32 (3.3.x)","WebSockets 2.7.2","U8g2 (SH1106 OLED)"]',
  '["Genum_WIRELESS_CAR source tree with Config.h pins","Wiring reference + flashing metadata","storyboard.md OLED spec"]',
  '4wd4m', 1
),
(
  '2wd1m-basic',
  '2WD1M Car',
  'Robot Cars', 'Project package', 'Catalog', 0, 'Request quote', 0,
  'Two-wheel car with a steering servo (2WD1M), driven over Bluetooth SPP by the hand-held ESP32 remote or app. Signed SPD (±255) controls the rear drive motor and SERVO (0..180) steers.',
  '2WD car with one drive motor plus a steering servo.',
  'Genum_2WD1M_CAR', '2 hours',
  'A compact two-wheel + servo car firmware for the ESP32 with Bluetooth Classic SPP drive, an OLED dashboard and fleet mode-registry support for the 2WD1M control mode.',
  '["Signed-speed drive (SPD ±255)","Servo steering (SERVO 0..180, centre 90)","Bluetooth Classic SPP slave","Fleet mode registry + COMING SOON frames","Boot state restore (mode + speed)"]',
  '["ESP32 Dev Module","L298N motor driver","1 × BO/brushed rear motor","1 × steering servo","1.3 inch SH1106 OLED (I2C)"]',
  '["Signed-speed motor control","Servo steering geometry (centre 90)","Bluetooth SPP pairing (PIN 1234)","Boot splash + OLED dashboard"]',
  '["Wire the L298N, servo and OLED per Config.h","Build with arduino-cli at default partition","Flash and pair via Bluetooth (PIN 1234)","Drive with the ESP REMOTE or app in 2WD1M mode"]',
  '["ESP REMOTE two-joystick (2WD1M)","Bluetooth SPP app"]',
  '["Arduino Core for ESP32 (3.3.x)","U8g2 (SH1106 OLED)"]',
  '["Genum_2WD1M_CAR source tree","Wiring reference + build metadata"]',
  '2wd1m', 2
),
(
  'self-balancing-basic',
  'Self-Balancing Car',
  'Robot Cars', 'Project package', 'Catalog', 0, 'Request quote', 0,
  'Two-wheeled self-balancing robot on the ESP32 with an MPU6050 IMU, runtime-tunable PID control, Bluetooth command/telemetry and an SH1106 OLED. Balances autonomously in AUTO mode.',
  'Self-balancing two-wheel bot with live PID tuning.',
  'Genum_SELF_BALANCE_CAR', '2–3 hours',
  'A modular ESP32 self-balancing robot: MPU6050 + complementary filter, PID control tunable at runtime, Bluetooth telemetry (Kp/Ki/Kd/OUT/OFF), OLED status UI and a failsafe motor stop.',
  '["Autonomous balancing (MPU6050 + complementary filter)","Runtime PID tuning with persistent storage","Bluetooth telemetry + legacy PID commands","OLED status + telemetry UI","Failsafe motor stop on comms loss"]',
  '["ESP32 Dev Module","L298N H-bridge","2 × DC motors","MPU6050 IMU (I2C)","1.3 inch SH1106 OLED (I2C)","Pushbutton (mode switch)"]',
  '["PID control + complementary filtering","IMU reading over I2C","Runtime tuning via Bluetooth tokens","Singleton persistence layer (NVS/EEPROM)","Non-blocking main loop"]',
  '["Wire I2C plus motor driver per Config.h defaults","Build with arduino-cli at default partition","Flash, then pair via Bluetooth (PIN 1234)","Balance and tune Kp/Ki/Kd/OUT/OFF live from the app or remote"]',
  '["ESP REMOTE (PID calibration)","Bluetooth SPP app (AUTO drive)"]',
  '["Arduino Core for ESP32 (3.3.x)","U8g2 (SH1106 OLED)","MPU6050 (I2C, Wire)"]',
  '["Genum_SELF_BALANCE_CAR source tree","Wiring reference (pin map in Config.h)"]',
  'self-balancing', 3
),
(
  'esp32-remote',
  'ESP32 Remote Controller',
  'Robot Cars', 'Project package', 'Catalog', 0, 'Request quote', 0,
  'Bluetooth (SPP master) hand-held remote for the GENUM car fleet: two joysticks, an SH1106 OLED, mode switching, joystick calibration, telemetry parsing and a coalescing command queue with safe-stop on disconnect.',
  'Hand-held ESP32 remote that drives the 2WD1M, self-balancing and wireless cars.',
  'Genum_REMOTE_ESP32', '2 hours',
  'The fleet remote controller firmware: dual-joystick drive input, OLED menus (greeting, discovery, dashboard, tuning), saved-network cache and always-on OTA so later updates are wireless.',
  '["Dual-joystick drive + steering input","OLED UI: discovery, dashboard, tuning screens","Mode switching incl. 2WD1M + AUTO calibration","Joystick calibration + EEPROM state","Safe-stop on disconnect + OTA updates"]',
  '["ESP32 Dev Module","2 × analog joysticks","2 × pushbuttons + joystick click","1.3 inch SH1106 OLED (I2C)"]',
  '["Bluetooth SPP master pairing","Coalescing command queue","OLED menu state-machine","NVS/EEPROM persistence","ArduinoOTA delivery"]',
  '["Build with PartitionScheme=min_spiffs","Flash once over USB (115200)","Pair to a GENUM car (PIN 1234)","Deliver later updates over the air (ESP32_Remote_OTA)"]',
  '["ESP REMOTE hand-held (2WD1M / self-balancing / wireless)"]',
  '["Arduino Core for ESP32 (3.3.x)","U8g2 (SH1106 OLED)"]',
  '["Genum_REMOTE_ESP32 source tree","Run sheets for device rounds 7–13"]',
  NULL, 4
),
(
  'smart-dustbin',
  'Smart Dustbin',
  'Robot Cars', 'Project package', 'Catalog', 0, 'Request quote', 0,
  'Autonomous smart dustbin: ESP32 + HC-SR04 ultrasonic + continuous servo. Approach detection opens the lid, open/close timing is tuned by constants, and the usage count persists across power cycles. Standalone IoT device.',
  'Hands-free lid that opens on approach, with persisted usage count.',
  'Genum_SMART_DUSTBIN', '1–2 hours',
  'A single self-contained ESP32 sketch that senses an approaching hand or object with an ultrasonic sensor and opens the bin lid with a continuous servo, keeping a power-cycle-safe usage counter.',
  '["Ultrasonic approach detection (HC-SR04)","Servo lid open/close on approach","Tunable open/close timing constants","Usage count persisted via Preferences","Single self-contained sketch, no radio"]',
  '["ESP32 Dev Module","HC-SR04 ultrasonic sensor","Continuous rotation servo","Battery/power for the servo"]',
  '["Ultrasonic ranging (TRIG/ECHO GPIO)","Servo PWM control","Preferences-backed counters","Simple state machine"]',
  '["Wire ultrasonic (TRIG 5, ECHO 18) and servo (signal 23)","Build with arduino-cli at default partition","Flash over USB and power on","Tune open/close timing in the sketch constants"]',
  '["None — standalone IoT device"]',
  '["Arduino Core for ESP32 (3.3.x)"]',
  '["Genum_SMART_DUSTBIN source tree","Wiring reference (pin table)"]',
  NULL, 5
)
on conflict (id) do update set
  name = excluded.name, category = excluded.category,
  product_type = excluded.product_type, inventory_type = excluded.inventory_type,
  price = excluded.price, price_label = excluded.price_label, stock = excluded.stock,
  description = excluded.description, note = excluded.note,
  source_folder = excluded.source_folder,
  estimated_duration = excluded.estimated_duration,
  project_overview = excluded.project_overview,
  objectives = excluded.objectives, materials_required = excluded.materials_required,
  learning_outcomes = excluded.learning_outcomes, build_steps = excluded.build_steps,
  control_methods = excluded.control_methods, prerequisites = excluded.prerequisites,
  deliverables = excluded.deliverables, car_mode_id = excluded.car_mode_id,
  sort_order = excluded.sort_order, updated_at = now();

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

-- ===== CAR PROFILES (per-user per-car settings + wifi history) =====
-- One row per (user, car). Mirrors robot_user_settings but for the CAR'S
-- identity: each robot is tracked by its STABLE profile key (`fw:<boardId>`,
-- BT MAC, or `wifi:<ssid>`). Holds the car's mode/speed/steer/trim, the
-- saved-router + BT-id sets, the Wi-Fi history (names only), and the
-- smart-link auto-join toggle. Passwords are never stored here (they only
-- ever live in flight + the car's NVS). Owner RLS, staff can read all.
create table if not exists public.car_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_key text not null,
  car_name text not null default '',
  unique_id text not null default '',
  settings jsonb not null default '{}'::jsonb,
  wifi_history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, profile_key)
);

create index if not exists car_profiles_user_idx on public.car_profiles (user_id);
create index if not exists car_profiles_profile_idx on public.car_profiles (profile_key);
create index if not exists car_profiles_unique_id_idx on public.car_profiles (unique_id);

create or replace function public.touch_car_profiles()
returns trigger set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists car_profiles_touch on public.car_profiles;
create trigger car_profiles_touch
before update on public.car_profiles
for each row execute function public.touch_car_profiles();

alter table public.car_profiles enable row level security;

drop policy if exists "car_profiles_select_own" on public.car_profiles;
create policy "car_profiles_select_own" on public.car_profiles
for select using (
  auth.uid() = user_id
  or public.is_staff()
);

drop policy if exists "car_profiles_insert_own" on public.car_profiles;
create policy "car_profiles_insert_own" on public.car_profiles
for insert with check (auth.uid() = user_id);

drop policy if exists "car_profiles_update_own" on public.car_profiles;
create policy "car_profiles_update_own" on public.car_profiles
for update using (
  auth.uid() = user_id
  or public.is_staff()
);

drop policy if exists "car_profiles_delete_own" on public.car_profiles;
create policy "car_profiles_delete_own" on public.car_profiles
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

-- ---------------------------------------------------------------------------
-- U-35 (2026-09-25): link-import attempt log
--
-- Owner: "don't keep track of any new providers submitted by the users too."
-- Every /api/admin/link-import `preview` records the pasted host, which
-- registered provider resolved it (NULL = unknown source), and the outcome, so
-- the owner can see which sources staff are actually trying and add the next
-- provider to the edge function's PROVIDERS registry on evidence rather than
-- on a support ticket.
--
-- Written ONLY by the `link-import` edge function through its service-role
-- client, so RLS is enabled with no policies: anon/authenticated get nothing,
-- staff read it through app/api/admin/import-attempts (service role).
-- ---------------------------------------------------------------------------
create table if not exists public.link_import_attempts (
  id bigint generated always as identity primary key,
  host text not null,
  provider text,
  provider_label text,
  outcome text not null,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists link_import_attempts_created_idx
  on public.link_import_attempts (created_at desc);

create index if not exists link_import_attempts_host_idx
  on public.link_import_attempts (host);

alter table public.link_import_attempts enable row level security;

comment on table public.link_import_attempts is
  'U-35: every link-import preview attempt (host, resolved provider, outcome). Service-role write from the link-import edge function; staff read via /api/admin/import-attempts. Lets the owner see which sources staff paste so new providers can be added on evidence.';


-- ===== PROJECT COMPONENTS (U-45, 2026-09-26) =====
-- Machine link between project packages and the Electronic Products catalog:
-- a project row lists the catalog components its build needs, with quantity.
-- Both columns reference products (product_type='Project package' on one
-- side; the components catalog on the other). Deleting a product cascades
-- its links. Public read (the detail pages render the lists); writes go
-- through the admin API with the service role (staff+ gate) — no client
-- write policies, exactly like products.
create table if not exists public.project_components (
  project_id text not null references public.products(id) on delete cascade,
  product_id text not null references public.products(id) on delete cascade,
  quantity integer not null default 1,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  primary key (project_id, product_id)
);

alter table public.project_components enable row level security;

drop policy if exists "public read project_components" on public.project_components;
create policy "public read project_components"
  on public.project_components for select using (true);

create index if not exists project_components_project_idx
  on public.project_components (project_id, sort_order);

create index if not exists project_components_product_idx
  on public.project_components (product_id);

comment on table public.project_components is
  'U-45: project package -> Electronic Product component links (quantity-aware). Staff-managed via the admin Projects tab linker, which pre-fills suggestions from materials_required via lib/project-components.ts.';

-- U-45 Phase 2 (2026-09-27): the NATIVE app's admin Projects tab needs the
-- same linker as the website, but the website's /api/admin/project-components
-- gate reads the website's session cookie — an app JWT cannot authorize on
-- it. The app's established pattern for staff-gated writes from the client
-- (mark_order_paid, restore_order_stock, admin_user_last_seen) is a SECURITY
-- DEFINER function that re-verifies the role server-side; the client calls
-- it with its own JWT via supabase.rpc. Same contract as the website PUT:
-- validate + clamp, drop dupes/invalid ids, replace-all semantics.
create or replace function public.save_project_components(
  p_project_id text,
  p_components jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_staff boolean;
  v_is_project boolean;
  v_valid_ids text[];
  v_rows jsonb;
  v_row jsonb;
  v_link record;
  v_id text;
  v_qty integer;
  v_i integer;
  v_saved integer := 0;
begin
  select coalesce(
    (select true from public.profiles
      where id = auth.uid() and role in ('staff', 'admin', 'owner')),
    false
  ) into v_is_staff;
  if not v_is_staff then
    raise exception 'Only staff members can save component links.' using
      errcode = '42501';
  end if;

  if p_project_id is null or length(trim(p_project_id)) = 0 then
    raise exception 'projectId is required.';
  end if;

  select exists (
    select 1 from public.products
    where id = p_project_id and product_type = 'Project package'
  ) into v_is_project;
  if not v_is_project then
    raise exception 'Project not found.';
  end if;

  -- Normalize the incoming array: numeric-safe clamp 1..99 (matching the
  -- website PUT), drop empty ids and duplicate product ids (last one wins).
  v_rows := coalesce(p_components, '[]'::jsonb);
  if jsonb_typeof(v_rows) <> 'array' then
    raise exception 'components must be an array.';
  end if;

  drop table if exists _pc_norm;
  create temp table _pc_norm (product_id text primary key, quantity integer)
    on commit drop;
  for v_i in 0 .. jsonb_array_length(v_rows) - 1 loop
    v_row := v_rows -> v_i;
    v_id := nullif(trim(coalesce(v_row ->> 'productId', '')), '');
    begin
      v_qty := greatest(1, least(99,
        coalesce(round(nullif(v_row ->> 'quantity', '')::numeric, 0)), 1));
    exception when others then
      v_qty := 1;
    end;
    if v_id is not null then
      insert into _pc_norm (product_id, quantity) values (v_id, v_qty)
        on conflict (product_id) do update set quantity = excluded.quantity;
    end if;
  end loop;

  -- Keep only ids that actually exist in the catalog (mirrors the website
  -- PUT's products-in check).
  select coalesce(array_agg(id), '{}'::text[]) into v_valid_ids
    from public.products
    where id in (select product_id from _pc_norm);
  delete from _pc_norm where product_id <> all (coalesce(v_valid_ids, '{}'::text[]));

  -- Replace-all: simplest, predictable contract (the editor always sends
  -- the full list), identical to the website endpoint.
  delete from public.project_components where project_id = p_project_id;
  for v_link in
    select product_id, quantity from _pc_norm
    order by quantity desc, product_id asc
  loop
    v_saved := v_saved + 1;
    insert into public.project_components (project_id, product_id, quantity, sort_order)
    values (
      p_project_id,
      v_link.product_id,
      v_link.quantity,
      v_saved * 10
    );
  end loop;

  return v_saved;
exception
  when others then
    begin
      drop table if exists _pc_norm;
    exception when others then
      null; -- temp table may not exist yet
    end;
    raise;
end;
$$;

comment on function public.save_project_components(text, jsonb) is
  'U-45 Phase 2: staff+ gated replace-all save for the app admin Projects linker (website parity with PUT /api/admin/project-components).';

-- =====================================================================
-- Project pricing (2026-11-13): per-project-package price calculator,
-- managed from the admin Projects tab and approved to publish. Mirrors the
-- 3D print studio pattern (print_settings / print_materials) but project-
-- specific: a project is priced from its linked catalog components (via the
-- project_components join) + a package base charge + optional extras +
-- bulk tiers + a minimum order, all DRAFT by default until an admin approves.
-- =====================================================================

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
  -- quantity -> % off the components + extras subtotal (parallel to print bulk_tiers)
  bulk_tiers jsonb not null default '[]',
  -- minimum quote value (NPR); below it the quote is auto-elevated (parallel to print minimum_order)
  minimum_order integer not null default 0 check (minimum_order >= 0),
  -- publication status: draft hides every price ("rate on request"); approved reveals them
  price_status text not null default 'draft',
  -- when the owner approved / last withdrew
  price_approved_at timestamptz,
  -- who approved / last withdrew
  price_approved_by text not null default ''',
  note text not null default '',
  updated_at timestamptz not null default now(),
  constraint project_pricing_price_status_check check (price_status in ('draft', 'approved'))
);

-- idempotent seed: draft defaults for any project package that has no pricing row yet.
-- Kept draft (pending GENUM approval) — the owner sets real base charges / markups /
-- extras / tiers in Admin → Projects → Pricing. The docx lists projects as quote-based,
-- so there is no docx number to mirror; defaults to 0 / "rate on request" until set.
insert into public.project_pricing (id, package_base_charge, component_markup_percent, extras, bulk_tiers, minimum_order, price_status, note)
  select id, 0, 0, '[]', '[]', 0, 'draft', ''
  from public.products
  where product_type = 'Project package'
    and not exists (select 1 from public.project_pricing pp where pp.id = products.id)
on conflict (id) do nothing;

alter table public.project_pricing enable row level security;

-- Public read: only approved rows are visible to anonymous users (the public
-- API and the storefront show prices only after an admin approves them).
drop policy if exists "public read approved project pricing" on public.project_pricing;
create policy "public read approved project pricing" on public.project_pricing
  for select using (price_status = 'approved');

-- Staff read: staff+ sees every row (draft + approved) so the admin editor can edit draft pricing.
drop policy if exists "staff read project pricing" on public.project_pricing;
create policy "staff read project pricing" on public.project_pricing
  for select using (public.is_staff());

-- Staff write: staff+ can insert/update project pricing rows.
drop policy if exists "staff write project pricing" on public.project_pricing;
create policy "staff write project pricing" on public.project_pricing
  for all using (public.is_staff());

-- Admin delete: only admin+owner may delete a project pricing row.
drop policy if exists "admin delete project pricing" on public.project_pricing;
create policy "admin delete project pricing" on public.project_pricing
  for delete using (public.is_admin());

-- ===== U-47 (2026-09-27): CATALOG RE-HOME + PROJECT TAXONOMY (owner) =====
-- Owner round: electronic/3D rows that landed in the wrong category move to
-- their own shelves; Projects become SIX owner-named categories (Robo Car
-- with its 3 car types, Smart Home, Smart Farm, Smart City, Smart Dustbin,
-- Aerial Drones) — one unified grid + category filter on web and app.

-- Three Retail-kit rows were mis-homed under 'Controllers & Boards' by an
-- import preset; they are mechanical/motor parts, not controllers.
update public.products set category = 'Mechanical Parts'
  where id = '4dof-wooden-robotic-arm-kit' and category = 'Controllers & Boards';
update public.products set category = 'Motors & Motion'
  where id in ('bo-motor-wheel-big', 'omni-wheel-48mm-l-r-pair')
    and category = 'Controllers & Boards';

-- Smart Dustbin was the only project row without its project_category.
update public.products set project_category = 'Smart Dustbin'
  where id = 'smart-dustbin'
    and product_type = 'Project package'
    and (project_category is null or project_category = '');

-- The SIX canonical project categories (owner names, verbatim intent).
-- 'Smart Home' is the renamed Home Automation (slug stays 'home-automation'
-- so remote/control-panel routing and stored references keep working).
insert into public.project_categories (id, name, icon, car_type, hardware, capabilities, capability_labels, capability_notes, car_mode_ids, sort_order) values
('home-automation', 'Smart Home', 'home', null,
  '[{"name":"ESP32 / ESP8266","role":"controller"},{"name":"Relay modules","role":"outputs"},{"name":"DHT / BME sensors","role":"environment"},{"name":"IR & motion","role":"detection"}]',
  '["relay","sensor","slider"]',
  '{"relay":"Channel switch","sensor":"Live readout","slider":"Level / threshold"}',
  '{"relay":"Toggle lights, fans, and appliance channels","sensor":"Read temperature, humidity, motion","slider":"Set dimmer or threshold levels"}',
  '[]',
  2)
on conflict (id) do update set
  name = excluded.name, icon = excluded.icon,
  hardware = excluded.hardware, capabilities = excluded.capabilities,
  capability_labels = excluded.capability_labels, capability_notes = excluded.capability_notes,
  sort_order = excluded.sort_order, updated_at = now();

insert into public.project_categories (id, name, icon, car_type, hardware, capabilities, capability_labels, capability_notes, car_mode_ids, sort_order) values
('smart-farm', 'Smart Farm', 'activity', null,
  '[{"name":"ESP32","role":"controller"},{"name":"Soil moisture","role":"sensor"},{"name":"Water pump / solenoid","role":"actuator"},{"name":"Relay","role":"power"}]',
  '["relay","sensor","slider"]',
  '{"relay":"Pump / valve switch","sensor":"Soil & weather readout","slider":"Watering threshold"}',
  '{"relay":"Drive pumps and solenoid valves","sensor":"Read soil moisture and weather","slider":"Set the auto-watering threshold"}',
  '[]',
  3)
on conflict (id) do update set
  name = excluded.name, icon = excluded.icon,
  hardware = excluded.hardware, capabilities = excluded.capabilities,
  capability_labels = excluded.capability_labels, capability_notes = excluded.capability_notes,
  sort_order = excluded.sort_order, updated_at = now();

insert into public.project_categories (id, name, icon, car_type, hardware, capabilities, capability_labels, capability_notes, car_mode_ids, sort_order) values
('smart-city', 'Smart City', 'map-pin', null,
  '[{"name":"ESP32","role":"controller"},{"name":"Sensors","role":"street telemetry"},{"name":"Relay","role":"streetlights"}]',
  '["relay","sensor","slider"]',
  '{"relay":"Streetlight / signal switch","sensor":"City telemetry","slider":"Light / timing level"}',
  '{"relay":"Toggle streetlights and signals","sensor":"Read city sensor telemetry","slider":"Set lighting or timing levels"}',
  '[]',
  4)
on conflict (id) do update set
  name = excluded.name, icon = excluded.icon,
  hardware = excluded.hardware, capabilities = excluded.capabilities,
  capability_labels = excluded.capability_labels, capability_notes = excluded.capability_notes,
  sort_order = excluded.sort_order, updated_at = now();

-- Drones: the 'drones' category row already exists (established slug used
-- by remote/control-panel routing); rename it to the owner's wording.
-- (An 'aerial-drones' duplicate briefly existed from the first apply of
-- this round — delete it idempotently; 'drones' is the canonical slug.)
delete from public.project_categories where id = 'aerial-drones';
update public.project_categories set name = 'Aerial Drones', icon = 'navigation',
  hardware = '[{"name":"Flight controller","role":"stabilization"},{"name":"Brushless motors","role":"lift"},{"name":"ESC","role":"motor drive"},{"name":"Camera / gimbal","role":"payload"}]'::jsonb,
  capabilities = '["relay","sensor","slider"]'::jsonb,
  capability_labels = '{"relay":"Aux channel (lights / drop)","sensor":"Altitude & battery","slider":"Throttle / gimbal"}'::jsonb,
  capability_notes = '{"relay":"Toggle aux channels (LED, payload drop)","sensor":"Read altitude and battery","slider":"Throttle curve or gimbal pan/tilt"}'::jsonb,
  sort_order = 6, updated_at = now()
  where id = 'drones';

-- ===== U-47: USER COLLECTION (owner: per-user saved cards across products,
-- projects, and services; shown on the user profile) =====
-- RLS-owned: members read/write only their own rows; the anon key cannot
-- see them. item_kind distinguishes products (incl. project packages —
-- they are products rows) from services; item_id matches the source table.
create table if not exists public.user_collection (
  -- user_id defaults to auth.uid() so a client insert never silently fails
  -- on a missing owner id (the 2026-09-27 "collection never shows" bug).
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  item_id text not null,
  item_kind text not null default 'product' check (item_kind in ('product', 'service')),
  created_at timestamptz not null default now(),
  primary key (user_id, item_id, item_kind)
);

alter table public.user_collection enable row level security;

-- Belt-and-braces for tables created before this default existed (2026-09-27
-- "collection never shows" bug: client inserts omitted user_id and the
-- not-null column made every write fail silently under RLS).
alter table public.user_collection alter column user_id set default auth.uid();

drop policy if exists "own collection select" on public.user_collection;
create policy "own collection select"
  on public.user_collection for select using (auth.uid() = user_id);
drop policy if exists "own collection insert" on public.user_collection;
create policy "own collection insert"
  on public.user_collection for insert with check (auth.uid() = user_id);
drop policy if exists "own collection delete" on public.user_collection;
create policy "own collection delete"
  on public.user_collection for delete using (auth.uid() = user_id);

create index if not exists user_collection_user_idx
  on public.user_collection (user_id, item_kind, created_at);

comment on table public.user_collection is
  'U-47: per-user saved cards (products/projects/services). Heart on any card toggles a row; the profile page lists the collection. RLS: own rows only.';

-- ===== CAR TELEMETRY (2026-09-28, Connections Hub round) =====
-- One row per telemetry data point the car stores or reports.
-- Read by the app when connected (via WS JSON `data` field) and persisted
-- for history/analytics. Retains only what's needed for per-user patterns;
-- raw per-session detail lives in `car_connection_sessions`.
create table if not exists public.car_telemetry (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_key text not null,
  recorded_at timestamptz not null default now(),
  data jsonb not null default '{}'::jsonb,   -- battery, rssi, mode, speed, etc.
  type text not null default 'generic',      -- generic|battery|rssi|mode|speed|...
  source text not null default 'app',        -- app|car|remote
  unique (user_id, profile_key, recorded_at, type)
);

create index if not exists car_telemetry_user_idx on public.car_telemetry (user_id);
create index if not exists car_telemetry_profile_idx on public.car_telemetry (profile_key);
create index if not exists car_telemetry_type_idx on public.car_telemetry (type);

-- Keep updated_at truthful on every write.
create or replace function public.touch_car_telemetry()
returns trigger set search_path = public as $$
begin
  new.recorded_at = now();
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists car_telemetry_touch on public.car_telemetry;
create trigger car_telemetry_touch
before update on public.car_telemetry
for each row execute function public.touch_car_telemetry();

-- RLS: user owns their car's telemetry; staff+ can read all.
alter table public.car_telemetry enable row level security;

drop policy if exists "car_telemetry_select_own" on public.car_telemetry;
create policy "car_telemetry_select_own"
  on public.car_telemetry for select using (
    auth.uid() = user_id
    or public.is_staff()
);

drop policy if exists "car_telemetry_insert_own" on public.car_telemetry;
create policy "car_telemetry_insert_own"
  on public.car_telemetry for insert with check (auth.uid() = user_id);

drop policy if exists "car_telemetry_update_own" on public.car_telemetry;
create policy "car_telemetry_update_own"
  on public.car_telemetry for update using (auth.uid() = user_id);

drop policy if exists "car_telemetry_delete_own" on public.car_telemetry;
create policy "car_telemetry_delete_own"
  on public.car_telemetry for delete using (auth.uid() = user_id);

-- ===== CAR CONNECTION SESSIONS (2026-09-28) =====
-- One row per car-connection session: what the car needs from the app or
-- remote when connected, for better accessibility and performance.
-- The app writes this when a link session starts; the edge function or
-- server can read it with the service role for diagnostics.
create table if not exists public.car_connection_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_key text not null,
  connected_at timestamptz not null default now(),
  disconnected_at timestamptz,
  remote_capabilities jsonb not null default '{}'::jsonb,   -- what the remote can do
  app_preferences jsonb not null default '{}'::jsonb,     -- app settings for this link
  performance_metrics jsonb not null default '{}'::jsonb, -- rssi, ip, mode, etc.
  created_at timestamptz not null default now()
);

create index if not exists car_connection_user_idx on public.car_connection_sessions (user_id);
create index if not exists car_connection_profile_idx on public.car_connection_sessions (profile_key);
create index if not exists car_connection_connected_idx on public.car_connection_sessions (connected_at);

-- RLS: user owns their connection sessions; staff+ can read all.
alter table public.car_connection_sessions enable row level security;

drop policy if exists "car_connection_select_own" on public.car_connection_sessions;
create policy "car_connection_select_own"
  on public.car_connection_sessions for select using (
    auth.uid() = user_id
    or public.is_staff()
);

drop policy if exists "car_connection_insert_own" on public.car_connection_sessions;
create policy "car_connection_insert_own"
  on public.car_connection_sessions for insert with check (auth.uid() = user_id);

drop policy if exists "car_connection_update_own" on public.car_connection_sessions;
create policy "car_connection_update_own"
  on public.car_connection_sessions for update using (auth.uid() = user_id);

drop policy if exists "car_connection_delete_own" on public.car_connection_sessions;
create policy "car_connection_delete_own"
  on public.car_connection_sessions for delete using (auth.uid() = user_id);

-- ===== U-47v2 (2026-09-27): PER-USER HABITS / BEHAVIOR STORE =====
-- Owner: "make a proper database of each user for better control of data
-- and habits of user." Aggregated, privacy-safe counters — NO raw page
-- history (page_views already covers that with its own RLS). One row per
-- user with counters the profile + future personalization read:
--   viewed_count   : product-detail opens (deduped per day+product)
--   search_count   : catalog searches submitted
--   cart_adds      : build-list additions
--   orders_placed  : denormalized from orders for a single-row read
--   last_*_at      : recency markers for each habit
-- RLS: the user updates their OWN row (upsert); staff may read all rows
-- for support; writes are merged client-side (read, add, write back).
create table if not exists public.user_habits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  viewed_count integer not null default 0,
  search_count integer not null default 0,
  cart_adds integer not null default 0,
  orders_placed integer not null default 0,
  last_viewed_at timestamptz,
  last_search_at timestamptz,
  last_cart_at timestamptz,
  last_order_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.user_habits enable row level security;

drop policy if exists "own habits select" on public.user_habits;
create policy "own habits select"
  on public.user_habits for select using (auth.uid() = user_id or public.is_staff());

drop policy if exists "own habits insert" on public.user_habits;
create policy "own habits insert"
  on public.user_habits for insert with check (auth.uid() = user_id);

drop policy if exists "own habits update" on public.user_habits;
create policy "own habits update"
  on public.user_habits for update using (auth.uid() = user_id);

comment on table public.user_habits is
  'U-47v2: aggregated per-user habit counters (views, searches, cart adds, orders). Own-row RLS + staff read. No raw browsing history — page_views keeps that.';

-- SECURITY DEFINER increments: the client cannot UPDATE via upsert against
-- a PRIMARY KEY row it has never read (insert would collide); a definer
-- function does read-modify-write atomically and re-verifies the caller.
create or replace function public.track_habit(p_kind text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return; -- guests: silently ignored, nothing tracked
  end if;

  insert into public.user_habits (user_id) values (v_uid)
  on conflict (user_id) do nothing;

  if p_kind = 'view' then
    update public.user_habits
      set viewed_count = viewed_count + 1, last_viewed_at = now(), updated_at = now()
      where user_id = v_uid;
  elsif p_kind = 'search' then
    update public.user_habits
      set search_count = search_count + 1, last_search_at = now(), updated_at = now()
      where user_id = v_uid;
  elsif p_kind = 'cart' then
    update public.user_habits
      set cart_adds = cart_adds + 1, last_cart_at = now(), updated_at = now()
      where user_id = v_uid;
  elsif p_kind = 'order' then
    update public.user_habits
      set orders_placed = orders_placed + 1, last_order_at = now(), updated_at = now()
      where user_id = v_uid;
  end if;
end;
$$;

comment on function public.track_habit(text) is
  'U-47v2: atomic habit increment for the signed-in user (view|search|cart|order). Guests are ignored.';

-- =====================================================================
-- User activity log + profile-entry tables (2026-11-08)
-- Admin-deletable per-user audit log and per-user profile entries, with
-- each car/project profile surfaced inside the user's profile. These are
-- intentionally separate from the existing profiles / car_profiles / activity_log
-- tables so the new admin panels and API routes can own reads/deletes via the
-- service role without touching the legacy tables.
-- =====================================================================

create table if not exists public.user_activity_log (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null default '',
  entity_type text not null default '',
  entity_id uuid,
  details jsonb not null default '{}',
  created_at timestamptz not null default now(),
  primary key (id)
);

create table if not exists public.profile_entry_types (
  id uuid not null default gen_random_uuid(),
  name text not null default '',
  description text not null default '',
  created_at timestamptz not null default now(),
  primary key (id)
);

insert into public.profile_entry_types (id, name, description)
values ('00000000-0000-0000-0000-000000000001', 'car profile', 'A robot car profile saved under this user.')
on conflict (id) do nothing;

create table if not exists public.user_profile_entries (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type_id uuid not null references public.profile_entry_types(id) on delete restrict,
  title text not null default '',
  body jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (id)
);

-- The create-table statements above already declare these foreign keys
-- inline. Re-adding them unconditionally raised 42710 on re-apply, so each
-- one is guarded and only fills a real gap on an older/partial table.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'user_activity_log_user_id_fkey'
      and conrelid = 'public.user_activity_log'::regclass
  ) then
    alter table public.user_activity_log
      add constraint user_activity_log_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'user_profile_entries_user_id_fkey'
      and conrelid = 'public.user_profile_entries'::regclass
  ) then
    alter table public.user_profile_entries
      add constraint user_profile_entries_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'user_profile_entries_type_id_fkey'
      and conrelid = 'public.user_profile_entries'::regclass
  ) then
    alter table public.user_profile_entries
      add constraint user_profile_entries_type_id_fkey
      foreign key (type_id) references public.profile_entry_types(id) on delete restrict;
  end if;
end
$$;

create index if not exists user_activity_log_user_id_idx
  on public.user_activity_log (user_id);
create index if not exists user_activity_log_created_at_idx
  on public.user_activity_log (created_at desc);
create index if not exists user_profile_entries_user_id_idx
  on public.user_profile_entries (user_id);
create index if not exists user_profile_entries_type_id_idx
  on public.user_profile_entries (type_id);
create index if not exists user_profile_entries_created_at_idx
  on public.user_profile_entries (created_at desc);

alter table public.user_activity_log enable row level security;
alter table public.profile_entry_types enable row level security;
alter table public.user_profile_entries enable row level security;

drop policy if exists "user_activity_log_select_own" on public.user_activity_log;
create policy "user_activity_log_select_own" on public.user_activity_log
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "user_activity_log_insert_own" on public.user_activity_log;
create policy "user_activity_log_insert_own" on public.user_activity_log
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "profile_entry_types_select_authenticated" on public.profile_entry_types;
create policy "profile_entry_types_select_authenticated" on public.profile_entry_types
  for select to authenticated
  using (true);

drop policy if exists "user_profile_entries_select_own" on public.user_profile_entries;
create policy "user_profile_entries_select_own" on public.user_profile_entries
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "user_profile_entries_insert_own" on public.user_profile_entries;
create policy "user_profile_entries_insert_own" on public.user_profile_entries
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "user_profile_entries_update_own" on public.user_profile_entries;
create policy "user_profile_entries_update_own" on public.user_profile_entries
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Staff/admin access, matching the "staff read X" / "admin delete X" pattern
-- used by activity_log, device_crash_reports and app_logs. The website reads
-- these tables with the service role (bypasses RLS); the mobile app reads with
-- the signed-in session and needs these policies.
drop policy if exists "staff read user activity log" on public.user_activity_log;
create policy "staff read user activity log" on public.user_activity_log
  for select to authenticated
  using (public.is_staff());

drop policy if exists "admin delete user activity log" on public.user_activity_log;
create policy "admin delete user activity log" on public.user_activity_log
  for delete to authenticated
  using (public.is_admin());

drop policy if exists "staff read user profile entries" on public.user_profile_entries;
create policy "staff read user profile entries" on public.user_profile_entries
  for select to authenticated
  using (public.is_staff());

drop policy if exists "admin delete user profile entries" on public.user_profile_entries;
create policy "admin delete user profile entries" on public.user_profile_entries
  for delete to authenticated
  using (public.is_admin());

-- =====================================================================
-- MIGRATION CONSOLIDATION (2026-11-12)
--
-- The sections below were applied to the live project only through
-- supabase/migrations/*.sql and were missing from this file. They are copied
-- here verbatim in effect (structure + RLS + functions + triggers) so this
-- file is once again a complete, replayable snapshot of the database.
--
-- Deliberately NOT copied: row data (device_models catalogue rows,
-- robo_car_modes_flags seed, robo_car_modes label updates, the one-off
-- fresh-start deletes). Seeds stay in their migrations; this file describes
-- shape, not contents.
-- =====================================================================

-- ===== PROFILES ENRICHMENT (20261001120000_device_registry) =====
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists avatar_color text;
alter table public.profiles add column if not exists city text;
alter table public.profiles add column if not exists country text;
alter table public.profiles add column if not exists timezone text;
alter table public.profiles add column if not exists units text;
alter table public.profiles add column if not exists locale text;
alter table public.profiles add column if not exists last_seen_at timestamptz;
alter table public.profiles add column if not exists onboarding_step text;

-- ===== DEVICE REGISTRY (20261001120000_device_registry) =====
-- device_models is the canonical model catalogue (6 fleet models).
-- Public read so the website and the app's anon key can both use it,
-- staff-only write, exactly like robo_car_modes.
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

-- devices is ONE physical unit, shared across every user. unique_id reuses
-- the app's EXISTING resolution rule (fw:<boardId> / <bt-mac> / wifi:<ssid>)
-- and is the same string the app persists as car_profiles.profile_key.
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

create index if not exists devices_model_idx on public.devices (model_id);
create index if not exists devices_last_seen_idx
  on public.devices (last_seen_at desc nulls last);

-- user_devices is the per-user, per-unit name: car_profiles is keyed by
-- (user_id, profile_key), so without this two users could hold conflicting
-- names for the SAME physical car.
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

-- RLS for devices + user_devices. The "owner read devices" policy queries
-- user_devices, and Postgres compiles a policy body at CREATE time, so this
-- must stay AFTER both tables exist.
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
-- NOTE: the original migration named this "owner insert devices" while the
-- body allowed staff only. 20261001140000 renamed it; "owner insert devices"
-- is intentionally never created here, or a re-run would fail.
drop policy if exists "owner insert devices" on public.devices;
drop policy if exists "staff insert devices" on public.devices;
create policy "staff insert devices"
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

-- updated_at triggers (same shape as car_profiles).
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

-- ===== DEVICE RELAY TOKEN DIGESTS (20261005130000_relay_token_digest) =====
-- One peppered SHA-256 digest per physical unit (U-94 Internet method).
-- A separate table on purpose: `devices` is readable by every owner, and
-- Postgres cannot column-revoke a table-level SELECT. RLS enabled with NO
-- policies means client roles get nothing; service_role bypasses RLS.
create table if not exists public.device_relay_tokens (
  device_id uuid primary key references public.devices(id) on delete cascade,
  -- 64 lowercase hex chars: the output of SHA-256. Constrained so a truncated
  -- or placeholder digest can never be stored and read as "configured".
  token_digest text not null check (token_digest ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

-- ===== ROBO CAR MODE FLAGS (20261001130000_mode_labels_and_planned_flags) =====
-- Marks the modes whose firmware does not exist yet, so the app can never
-- imply a car that is not built.
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

-- ===== DEVICE CRASH REPORTS (20261008180000_device_crash_reports) =====
-- Crash/reset telemetry the app syncs from the car on connect, for fleet
-- firmware diagnostics. board_id is the firmware ESP.getEfuseMac() last-6 hex.
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

-- 20261109_admin_manage_rls: the app reads with the signed-in admin session,
-- so service-role-only access left its System Logs panel empty.
drop policy if exists "staff read crash reports" on public.device_crash_reports;
create policy "staff read crash reports" on public.device_crash_reports
  for select to authenticated
  using (public.is_staff());

drop policy if exists "admin delete crash reports" on public.device_crash_reports;
create policy "admin delete crash reports" on public.device_crash_reports
  for delete to authenticated
  using (public.is_admin());

comment on table public.device_crash_reports is
  'Crash/reset telemetry the app syncs from the car on connect, for fleet firmware diagnostics.';

-- ===== APP LOGS (20261012100000_app_logs) =====
-- Warn/error ring-buffer rows flushed from the app, readable by staff/admin.
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

-- 20261109_admin_manage_rls: matching read policy + explicit admin delete.
drop policy if exists "staff read app logs" on public.app_logs;
create policy "staff read app logs" on public.app_logs
  for select to authenticated
  using (public.is_staff());

drop policy if exists "admin delete app logs" on public.app_logs;
create policy "admin delete app logs" on public.app_logs
  for delete to authenticated
  using (public.is_admin());

comment on table public.app_logs is
  'Warn/error ring-buffer rows flushed from the app; read by staff/admin for diagnostics across the fleet.';

-- ===== REGISTER DEVICE RPC (20261001140000, fixed by 20261001160000,
--       rate limited by 20261001170000 — this is the final shape) =====
-- SECURITY DEFINER so owners can claim units without a blanket INSERT policy
-- on the shared devices table. A reported model_id fills a gap only; it never
-- overwrites a curated value. New units are rate limited per account;
-- re-claiming a unit you already own is not.
create or replace function public.register_device(
  p_unique_id text,
  p_model_id  text default null,
  p_fw_version text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_device_id uuid;
  v_recent_links integer;
  v_already_owned boolean;
  c_max_new_devices_per_hour constant integer := 10;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;

  -- Reject empty/oversized identities rather than storing junk that would
  -- later fail the app's own resolveProfileKey rules.
  if p_unique_id is null or length(btrim(p_unique_id)) = 0 or length(p_unique_id) > 128 then
    raise exception 'invalid unique_id';
  end if;

  -- model_id is a foreign key; validate up front so a typo is a clear error
  -- instead of a constraint violation with a worse message. The argument is
  -- still inserted on a fresh row, so this check has to stay even though an
  -- existing curated value now wins the conflict.
  if p_model_id is not null and not exists (
    select 1 from public.device_models where id = p_model_id
  ) then
    raise exception 'unknown model_id: %', p_model_id;
  end if;

  -- Rate limit, and only for units this account does not already own. An
  -- existing owner refreshing last_seen_at is never rate limited.
  select exists (
    select 1
    from public.user_devices ud
    join public.devices d on d.id = ud.device_id
    where ud.user_id = auth.uid() and d.unique_id = btrim(p_unique_id)
  ) into v_already_owned;

  if not coalesce(v_already_owned, false) then
    select count(*)::integer into v_recent_links
    from public.user_devices
    where user_id = auth.uid()
      and created_at > now() - interval '1 hour';

    if v_recent_links >= c_max_new_devices_per_hour then
      raise exception 'too many new devices added in the last hour (limit %) - try again later',
        c_max_new_devices_per_hour;
    end if;
  end if;

  -- Upsert on unique_id. The UPDATE branch only ever refreshes fields a
  -- device legitimately reports about ITSELF; no owner-controlled text
  -- (nickname) and no user-scoped data can be set from here.
  insert into public.devices as d (unique_id, model_id, fw_version, last_seen_at)
  values (btrim(p_unique_id), p_model_id, coalesce(p_fw_version, ''), now())
  on conflict (unique_id) do update
    set last_seen_at = now(),
        -- A reported model only fills a gap; it never overwrites a value a
        -- staff member curated, and null means "did not say".
        -- coalesce() returns its first non-null argument, so d.model_id MUST
        -- come first here. Getting this backwards is what 20261001140000 did.
        model_id = coalesce(d.model_id, excluded.model_id),
        fw_version = case
          when excluded.fw_version <> '' then excluded.fw_version
          else d.fw_version
        end
  returning id into v_device_id;

  -- Link to the CALLER. auth.uid() is not a parameter, so this cannot be
  -- used to add a device to someone else's garage.
  insert into public.user_devices (user_id, device_id, display_name)
  values (auth.uid(), v_device_id, '')
  on conflict (user_id, device_id) do update
    set updated_at = now();

  return v_device_id;
end;
$$;

-- Only signed-in users may call it. anon must not be able to mint devices.
revoke execute on function public.register_device(text, text, text) from public;
revoke execute on function public.register_device(text, text, text) from anon;
grant execute on function public.register_device(text, text, text) to authenticated;

comment on function public.register_device(text, text, text) is
  'Register/refresh a physical unit by its stable unique_id and link it to the calling user. SECURITY DEFINER so owners can claim units without a blanket INSERT policy on the shared devices table. A reported model_id fills a gap only. New units are rate limited per account; re-claiming a unit you already own is not.';

-- ===== RETENTION (20261013120000_phase7c_fresh_start_cleanup) =====
create or replace function public.purge_old_crash_reports()
returns integer
language plpgsql
set search_path = public
as $$
declare
  deleted_count integer;
begin
  delete from public.device_crash_reports
  where reported_at < now() - interval '30 days';
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

create or replace function public.purge_old_app_logs()
returns integer
language plpgsql
set search_path = public
as $$
declare
  deleted_count integer;
begin
  delete from public.app_logs
  where created_at < now() - interval '30 days';
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

grant execute on function public.purge_old_crash_reports() to authenticated;
grant execute on function public.purge_old_app_logs() to authenticated;

comment on function public.purge_old_crash_reports() is
  'Deletes device_crash_reports rows older than 30 days. Call manually or schedule via pg_cron.';
comment on function public.purge_old_app_logs() is
  'Deletes app_logs rows older than 30 days. Call manually or schedule via pg_cron.';

-- ===== USER LOG WRITERS (20261109_user_logs_writers) =====
-- One trigger per table covers both clients (Next route and direct Supabase),
-- so the User Logs / Profile Entries panels cannot drift from the data.
create or replace function public.mirror_car_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  car_type_id constant uuid := '00000000-0000-0000-0000-000000000001';
  entry_body jsonb;
begin
  if tg_op = 'DELETE' then
    delete from public.user_profile_entries
     where user_id = old.user_id
       and body ->> 'profile_key' = old.profile_key
       and type_id = car_type_id;

    insert into public.user_activity_log (user_id, action, entity_type, entity_id, details)
    values (old.user_id, 'car_profile_deleted', 'car_profile', null,
            jsonb_build_object('profile_key', old.profile_key, 'car_name', old.car_name));
    return old;
  end if;

  entry_body := jsonb_build_object(
    'profile_key', new.profile_key,
    'car_name', new.car_name,
    'unique_id', new.unique_id,
    'settings', new.settings
  );

  update public.user_profile_entries
     set title = coalesce(nullif(new.car_name, ''), new.profile_key),
         body = entry_body,
         updated_at = now()
   where user_id = new.user_id
     and body ->> 'profile_key' = new.profile_key
     and type_id = car_type_id;

  if not found then
    insert into public.user_profile_entries (user_id, type_id, title, body, created_at, updated_at)
    values (new.user_id, car_type_id,
            coalesce(nullif(new.car_name, ''), new.profile_key),
            entry_body, new.created_at, now());
  end if;

  insert into public.user_activity_log (user_id, action, entity_type, entity_id, details)
  values (new.user_id, 'car_profile_saved', 'car_profile', new.id,
          jsonb_build_object('profile_key', new.profile_key, 'car_name', new.car_name));

  return new;
end
$$;

drop trigger if exists mirror_car_profile_on_write on public.car_profiles;
create trigger mirror_car_profile_on_write
  after insert or update on public.car_profiles
  for each row execute function public.mirror_car_profile();

drop trigger if exists mirror_car_profile_on_delete on public.car_profiles;
create trigger mirror_car_profile_on_delete
  after delete on public.car_profiles
  for each row execute function public.mirror_car_profile();

create or replace function public.log_order_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    insert into public.user_activity_log (user_id, action, entity_type, entity_id, details)
    values (new.user_id, 'order_placed', 'order', new.id,
            jsonb_build_object('total_npr', new.total_npr, 'status', new.status,
                               'provider', new.provider));
  elsif new.status is distinct from old.status then
    insert into public.user_activity_log (user_id, action, entity_type, entity_id, details)
    values (new.user_id, 'order_status_changed', 'order', new.id,
            jsonb_build_object('from', old.status, 'to', new.status));
  end if;

  return new;
end
$$;

drop trigger if exists log_order_activity_on_write on public.orders;
create trigger log_order_activity_on_write
  after insert or update of status on public.orders
  for each row execute function public.log_order_activity();

comment on function public.mirror_car_profile() is
  'Keeps user_profile_entries + user_activity_log in step with car_profiles for both clients.';
comment on function public.log_order_activity() is
  'Records per-user order activity for the admin User Logs panel.';

-- ===== ADMIN MANAGE RLS (20261109_admin_manage_rls +
--       20261109_admin_update_profiles) =====
-- The website reads these tables with the service-role key; the app uses the
-- signed-in admin session, so without these the app panels show only the
-- admin's own rows and edits silently change nothing.
drop policy if exists "staff read car profiles" on public.car_profiles;
create policy "staff read car profiles" on public.car_profiles
  for select to authenticated
  using (public.is_staff());

drop policy if exists "admin delete car profiles" on public.car_profiles;
create policy "admin delete car profiles" on public.car_profiles
  for delete to authenticated
  using (public.is_admin());

drop policy if exists "admin insert" on public.car_profiles;
create policy "admin insert" on public.car_profiles
  for insert to authenticated
  with check (public.is_admin());

drop policy if exists "admin update" on public.car_profiles;
create policy "admin update" on public.car_profiles
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "staff read robot settings" on public.robot_user_settings;
create policy "staff read robot settings" on public.robot_user_settings
  for select to authenticated
  using (public.is_staff());

drop policy if exists "admin delete robot settings" on public.robot_user_settings;
create policy "admin delete robot settings" on public.robot_user_settings
  for delete to authenticated
  using (public.is_admin());

drop policy if exists "admin insert" on public.robot_user_settings;
create policy "admin insert" on public.robot_user_settings
  for insert to authenticated
  with check (public.is_admin());

drop policy if exists "admin update" on public.robot_user_settings;
create policy "admin update" on public.robot_user_settings
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 20261109_user_logs_staff_rls: profile entry types stay service-role
-- writable; admin delete keeps the app's panel able to remove a custom type.
drop policy if exists "staff delete profile entry types" on public.profile_entry_types;
drop policy if exists "admin delete profile entry types" on public.profile_entry_types;
create policy "admin delete profile entry types" on public.profile_entry_types
  for delete to authenticated
  using (public.is_admin());

comment on policy "staff read user activity log" on public.user_activity_log is
  'Admins read every user''s activity log from the app admin panel.';
comment on policy "staff read user profile entries" on public.user_profile_entries is
  'Admins read every user''s profile entries from the app admin panel.';

-- ===== AUTH FAILURE TRACKING (2026-11-12) =====
-- "Suspicious sign-in" is decided server-side: three failed password attempts
-- for the same address inside 15 minutes makes the next attempt require an
-- emailed code (see app/api/auth/login/route.ts). Counters live in the
-- database because serverless instances do not share memory.
-- RLS is enabled with NO policies on purpose: only the service role reads or
-- writes this table, and no client can enumerate other people's attempts.
create table if not exists public.auth_failures (
  id bigint generated always as identity primary key,
  email text not null,
  ip text,
  created_at timestamptz not null default now()
);

create index if not exists auth_failures_email_time_idx
  on public.auth_failures (email, created_at desc);

alter table public.auth_failures enable row level security;

-- ===== 3D PRINT STUDIO (2026-11-13) =====
-- Mirrors supabase/migrations/20261113120000_print_studio.sql so a fresh
-- db:apply from this file produces the same schema.
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
  ('pla', 'PLA', 'The everyday choice: crisp detail, easy to print, best for display models, teaching aids and prototypes that will not sit in a hot car.', 12, 'Proposed NPR 12/g — pending owner approval.', 1),
  ('petg', 'PETG', 'Tougher and slightly flexible with better heat and water resistance — a good fit for brackets, jigs and parts that take a knock.', 16, 'Proposed NPR 16/g — pending owner approval.', 2)
on conflict (id) do nothing;

insert into public.print_settings (id, minimum_order, bulk_tiers) values
  (1, 350, '[{"minQty":10,"discountPercent":5},{"minQty":50,"discountPercent":10},{"minQty":100,"discountPercent":15}]'::jsonb)
on conflict (id) do update set minimum_order = excluded.minimum_order, bulk_tiers = excluded.bulk_tiers;

-- NOTE: pricing_status stays 'draft' (pending GENUM approval). The docx lists all
-- prices as proposed / pending approval — do NOT set pricing_status = 'approved'
-- here. The owner approves in Admin → 3D Products → Pricing when ready.

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

-- =====================================================================
-- 3D printing business layer (mirrors
-- migrations/20261113160000_print_business.sql)
--
-- Pricing has an explicit approval state, the custom-services strip is
-- admin-managed, internal costing lives in a staff-only table, and quote
-- requests carry the figures a workshop quotes from. Nothing here publishes
-- a price: rates still start at 0 and the calculator still ships disabled.
-- =====================================================================

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

-- internal costing: staff-only, never exposed to a customer surface
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

alter table public.print_services enable row level security;
alter table public.print_costing enable row level security;

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
      'new', 'reviewing', 'needs_info', 'quoted', 'approved',
      'printing', 'ready', 'completed', 'rejected', 'cancelled'
    )
  );
