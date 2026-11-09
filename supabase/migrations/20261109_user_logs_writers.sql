-- =====================================================================
-- 20261109_user_logs_writers.sql
-- Makes the User Logs / Profile Entries admin panels meaningful by having the
-- database itself record the events, instead of requiring every client to
-- remember to write them.
--
-- Why triggers: the website and the mobile app both write to car_profiles and
-- orders through different paths (Next route vs direct Supabase). One trigger
-- per table covers both clients, cannot drift, and costs nothing on the free
-- tier (no edge functions, no extra requests).
--
-- Writes:
--   car_profiles insert/update -> user_profile_entries upsert (type: car profile)
--                              -> user_activity_log 'car_profile_saved'
--   car_profiles delete        -> matching user_profile_entries row removed
--                                -> user_activity_log 'car_profile_deleted'
--   orders insert              -> user_activity_log 'order_placed'
--   orders status change       -> user_activity_log 'order_status_changed'
--
-- Backfills existing car_profiles rows so the panels are not empty on day one.
-- Idempotent: safe to re-run (triggers are dropped and recreated).
-- =====================================================================

-- ---- car profiles ---------------------------------------------------
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

-- ---- orders ---------------------------------------------------------
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

-- ---- backfill existing car profiles ---------------------------------
insert into public.user_profile_entries (user_id, type_id, title, body, created_at, updated_at)
select cp.user_id,
       '00000000-0000-0000-0000-000000000001'::uuid,
       coalesce(nullif(cp.car_name, ''), cp.profile_key),
       jsonb_build_object('profile_key', cp.profile_key, 'car_name', cp.car_name,
                          'unique_id', cp.unique_id, 'settings', cp.settings),
       cp.created_at,
       now()
  from public.car_profiles cp
 where not exists (
   select 1 from public.user_profile_entries e
    where e.user_id = cp.user_id
      and e.body ->> 'profile_key' = cp.profile_key
 );

comment on function public.mirror_car_profile() is
  'Keeps user_profile_entries + user_activity_log in step with car_profiles for both clients.';
comment on function public.log_order_activity() is
  'Records per-user order activity for the admin User Logs panel.';
