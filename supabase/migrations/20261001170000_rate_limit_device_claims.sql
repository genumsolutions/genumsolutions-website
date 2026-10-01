-- ---------------------------------------------------------------------
-- Rate-limit register_device(): bound how many NEW units one account can
-- add to the shared `devices` fleet table
--
-- The problem
-- -----------
-- register_device() is deliberately open to any signed-in user, because the
-- alternative (letting users insert into `devices` directly) is worse and was
-- already rejected - the table is shared fleet data, so a blanket user INSERT
-- would let anyone attach ANY car to their garage.
--
-- But "you may claim units" is not the same as "you may claim units without
-- limit", and nothing enforced the second. register_device() is a
-- SECURITY DEFINER function that INSERTS into `devices`, which the RLS policy
-- otherwise restricts to staff. So a script with one throwaway account could
-- insert unbounded junk unique_ids into the shared fleet table, and nothing
-- in the schema would distinguish that from legitimate growth. The table is
-- the thing every product page, garage and control deck resolves a car
-- through, so pollution is not contained to the attacker.
--
-- Deliberately NOT addressed here
-- ------------------------------
-- register_device() still cannot prove PHYSICAL POSSESSION. A signed-in user
-- can link a unique_id they have merely seen or guessed. That is per-user
-- scoped and exposes nobody else's data, and fixing it properly needs a
-- challenge the FIRMWARE answers (car prints a nonce, app relays it), which
-- is a firmware + protocol change and cannot land as a migration. Until that
-- exists this limit bounds the damage rather than removing it.
--
-- The limit
-- ---------
-- 10 NEW devices per account per rolling hour.
--
-- Counted on `user_devices.created_at`, not `devices.created_at`:
--  * it is per-user, which is the axis being limited;
--  * it is set when the LINK is made, so a user re-claiming a car they
--    already own does not consume budget - otherwise reconnecting one car ten
--    times an hour would lock the owner out of their own garage;
--  * `devices.created_at` describes when a UNIT entered the fleet, so a user
--    claiming a car somebody else registered months ago would be charged for
--    someone else's row.
--
-- 10/hour is far above real use. A household with several cars connecting
-- them all at once uses a handful; the number exists to cap a script, not to
-- ration owners.
--
-- If this ever needs to be looser it is one constant below. It is NOT a
-- security boundary on its own - it bounds volume, not identity.
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
  -- existing curated value now wins the conflict (20261001160000).
  if p_model_id is not null and not exists (
    select 1 from public.device_models where id = p_model_id
  ) then
    raise exception 'unknown model_id: %', p_model_id;
  end if;

  -- Rate limit, and only for units this account does not already own. An
  -- existing owner refreshing last_seen_at is never rate limited: the garage
  -- must keep working for a real car.
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

-- CREATE OR REPLACE keeps existing privileges; re-asserted so this file is
-- self-contained and re-runnable on a fresh database.
revoke execute on function public.register_device(text, text, text) from public;
revoke execute on function public.register_device(text, text, text) from anon;
grant execute on function public.register_device(text, text, text) to authenticated;

comment on function public.register_device(text, text, text) is
  'Register/refresh a physical unit by its stable unique_id and link it to the calling user. SECURITY DEFINER so owners can claim units without a blanket INSERT policy on the shared devices table. A reported model_id fills a gap only. New units are rate limited per account; re-claiming a unit you already own is not.';
