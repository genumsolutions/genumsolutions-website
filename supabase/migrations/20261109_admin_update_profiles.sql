-- ============================================================================
-- 20261109_admin_update_profiles.sql
--
-- The admin dashboard lets staff repair a customer's robot settings and
-- project (car) profiles. The website reaches these tables with the service
-- role, so it worked already; the app reads and writes with the signed-in
-- session, and until now the only write policies on both tables were
-- "own row" (car_profiles_update_own / robot_user_settings_update_own), so an
-- admin editing someone else's row from the app silently changed nothing.
--
-- `20261109_admin_manage_rls.sql` granted staff SELECT and admin DELETE on
-- both tables. This adds the missing INSERT and UPDATE, scoped to admin+ (not
-- staff): repairing a customer's device configuration is an admin operation.
-- The user's own-row policies stay exactly as they were.
-- ============================================================================

do $$
declare
  t text;
begin
  foreach t in array array['car_profiles', 'robot_user_settings'] loop
    if to_regclass('public.' || t) is null then
      raise notice 'skip %: table missing', t;
      continue;
    end if;

    execute format('drop policy if exists "admin insert" on public.%I', t);
    execute format(
      'create policy "admin insert" on public.%I for insert to authenticated with check (public.is_admin())',
      t
    );

    execute format('drop policy if exists "admin update" on public.%I', t);
    execute format(
      'create policy "admin update" on public.%I for update to authenticated using (public.is_admin()) with check (public.is_admin())',
      t
    );
  end loop;
end $$;
