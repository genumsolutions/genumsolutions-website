-- ---------------------------------------------------------------------
-- Fix: register_device() let a caller OVERWRITE a curated model_id
--
-- The bug
-- -------
-- 20261001140000 declared:
--
--   model_id = coalesce(excluded.model_id, d.model_id)
--
-- and, three lines above it, a comment promising the opposite:
--
--   "A reported model only fills a gap; it never overwrites a value a
--    staff member curated, and null means 'did not say'."
--
-- coalesce() returns its FIRST non-null argument, so this is backwards:
-- the caller's self-reported model wins whenever it is non-null, and the
-- existing curated value is only kept when the caller says nothing. The
-- documented behaviour and the implemented behaviour are opposites.
--
-- Why it matters
-- --------------
-- `devices` is the SHARED fleet table. `device_models` is a foreign key
-- into the curated catalogue, and the website resolves a unit's model to
-- decide which product page, controls and mode set belong to it. So the
-- bug let ANY signed-in user who knew or guessed a unit's unique_id
-- silently retype somebody else's car - e.g. turn a 4WD4M into a
-- smart-dustbin, which then drives the wrong control deck and shows the
-- wrong advertised name.
--
-- Reproduced live before fixing:
--   curated model before claim : 4wd4m
--   model after user claim     : smart-dustbin
--
-- The fix
-- -------
-- Reverse the argument order so the EXISTING curated value is kept and a
-- reported model is used only to fill a genuine gap:
--
--   model_id = coalesce(d.model_id, excluded.model_id)
--
-- This also makes the function match its own comment and the file header
-- contract, which is why the test in
-- tests/register-device-model-guard.test.ts asserts the SQL text itself:
-- a silent "simplification" back to excluded-first would otherwise pass
-- every unit test in the repo.
--
-- Deliberately NOT changed
-- ------------------------
-- fw_version and last_seen_at still refresh from the caller's report.
-- Those are genuinely self-reported by the unit, not curated by staff, and
-- a garage that never went stale is the point. model_id was different: it
-- is catalogue data, so it is first-write-wins.
--
-- The separate, still-open limitation (not a regression, unchanged here):
-- register_device() cannot prove physical possession, so a signed-in user
-- can still LINK an arbitrary unique_id into their own garage and see its
-- model/fw/last_seen. That is scoped per-user and exposes no other user's
-- data, but it is spoofable and needs a device challenge or rate limit
-- before production. See guide/FAILSAFES.md.
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
  -- instead of a constraint violation with a worse message. Validating the
  -- ARGUMENT is still required even though an existing value now wins,
  -- otherwise this check would silently accept junk on a fresh insert.
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

-- CREATE OR REPLACE keeps existing privileges, but the grants are re-asserted
-- so this file is self-contained and re-runnable on a fresh database.
revoke execute on function public.register_device(text, text, text) from public;
revoke execute on function public.register_device(text, text, text) from anon;
grant execute on function public.register_device(text, text, text) to authenticated;

comment on function public.register_device(text, text, text) is
  'Register/refresh a physical unit by its stable unique_id and link it to the calling user. SECURITY DEFINER so owners can claim units without a blanket INSERT policy on the shared devices table. A reported model_id fills a gap only; it never overwrites a curated value.';
