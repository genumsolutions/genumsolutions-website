-- Corrective: let a signed-in user register the car they just drove.
--
-- FOUND BY AUDIT (2026-10-01): migration 20261001120000 created a policy
-- NAMED "owner insert devices" whose body is `public.is_staff()`. The name
-- promises owners can insert; the body lets only staff. So:
--
--   mobile/src/services/deviceRegistryService.ts ensureDevice()
--     -> supabase.from("devices").upsert({ unique_id, model_id, ... })
--     -> 42501 new row violates row-level security policy
--     -> returns { uniqueId, deviceId: null }
--     -> the car is NEVER linked to the user
--     -> the garage stays empty forever
--
-- The obvious fix - `with check (auth.role() = 'authenticated')` - is worse
-- than the bug. `devices` is the SHARED fleet table: a blanket insert policy
-- would let any signed-in user invent rows for any unique_id, including
-- hijacking a real car's row (the ON CONFLICT DO UPDATE half of an upsert is
-- covered by the UPDATE policy, so a crafted upsert could rewrite another
-- unit's model_id / last_seen_at).
--
-- So registration moves behind a SECURITY DEFINER function. It keeps the
-- staff-only insert policy intact and gives the caller exactly one
-- capability: link a uniquely-identified unit to their OWN account, and
-- record that they were just seen. It never writes a caller-supplied
-- user_id, and it never touches another user's row.
--
-- Also in this file: the backfill that makes the existing car_profiles row
-- visible in the garage (see section 3).

-- ---------------------------------------------------------------------
-- 1. register_device(): upsert the unit, then link it to the caller.
--    SECURITY DEFINER so it can insert into devices despite the staff-only
--    policy. search_path is pinned to prevent search-path hijacking.
-- ---------------------------------------------------------------------
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
  -- instead of a constraint violation with a worse message.
  if p_model_id is not null and not exists (
    select 1 from public.device_models where id = p_model_id
  ) then
    raise exception 'unknown model_id: %', p_model_id;
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
        model_id = coalesce(excluded.model_id, d.model_id),
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
  'Register/refresh a physical unit by its stable unique_id and link it to the calling user. SECURITY DEFINER so owners can claim units without a blanket INSERT policy on the shared devices table.';

-- ---------------------------------------------------------------------
-- 2. Keep the misleading policy name honest.
--    "owner insert devices" reads like owners can insert. They cannot, by
--    design (see the header). Rename it so the next reader is not misled.
--    DROP + CREATE is the only way to rename a policy in Postgres, and BOTH
--    names must be dropped: after the first run the new name already exists,
--    so dropping only the old one makes any re-run fail with
--    'policy "staff insert devices" ... already exists'.
-- ---------------------------------------------------------------------
drop policy if exists "owner insert devices" on public.devices;
drop policy if exists "staff insert devices" on public.devices;
create policy "staff insert devices"
  on public.devices for insert with check (public.is_staff());

-- ---------------------------------------------------------------------
-- 3. Backfill: make the ONE existing car_profiles row a real device.
--
--    The fleet has exactly one driven car today:
--      profile_key 'fw:1FB608', car_name '08:B6:1F:98:2F:F6' (the raw MAC),
--      settings.mode_id '4wd4m'.
--
--    car_profiles stays in place and is NOT migrated away: the app restores
--    drive settings from it, and those settings have no home in the registry
--    (the registry holds identity, not joystick/speed state). This backfill
--    only ADDS the identity row + owner link the garage reads, and copies
--    the MAC as the owner's name so the entry is recognisable instead of
--    showing a bare fingerprint.
--
--    Guarded three ways so it is safe to re-run and safe for other users:
--      * only profiles whose key is not already a device,
--      * never touches another account's device,
--      * the owner link is the profile's own user_id.
-- ---------------------------------------------------------------------
insert into public.devices (unique_id, model_id, nickname, last_seen_at)
select
  cp.profile_key,
  -- settings.mode_id holds a MODE id ('4wd4m'), which coincides with a
  -- MODEL id only for that one row. Anything that is not an existing model
  -- becomes NULL rather than a dangling foreign key.
  case when exists (select 1 from public.device_models m where m.id = cp.settings->>'mode_id')
       then cp.settings->>'mode_id' else null end,
  cp.car_name,
  cp.updated_at
from public.car_profiles cp
where cp.profile_key is not null
  and btrim(cp.profile_key) <> ''
  and not exists (select 1 from public.devices d where d.unique_id = cp.profile_key)
on conflict (unique_id) do nothing;

insert into public.user_devices (user_id, device_id, display_name)
select cp.user_id, d.id, cp.car_name
from public.car_profiles cp
join public.devices d on d.unique_id = cp.profile_key
on conflict (user_id, device_id) do nothing;
