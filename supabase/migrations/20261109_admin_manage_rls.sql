-- =====================================================================
-- 20261109_admin_manage_rls.sql
-- Makes the admin management surfaces actually manageable from BOTH clients.
--
-- Problem this fixes (verified against the live project on 2026-11-09):
--   car_profiles, robot_user_settings, device_crash_reports and app_logs only
--   had per-user policies ("own" select/insert/update/delete). The website
--   reads them with the service-role key so it worked, but the mobile app reads
--   with the signed-in admin session — so the app's Users / System Logs panels
--   silently showed only the admin's own rows, and nobody could delete a
--   robot profile, user car profile, crash report or app log from the app.
--
-- Adds the same convention the rest of the schema uses:
--   "staff read <thing>"   -> for select using (public.is_staff())
--   "admin delete <thing>" -> for delete using (public.is_admin())
--
-- Row-level access only; no new tables, functions or extensions, so it costs
-- nothing on the free tier.
-- Idempotent: safe to re-run.
-- =====================================================================

-- ---- car profiles (robot profile per user's car) --------------------
drop policy if exists "staff read car profiles" on public.car_profiles;
create policy "staff read car profiles" on public.car_profiles
  for select to authenticated
  using (public.is_staff());

drop policy if exists "admin delete car profiles" on public.car_profiles;
create policy "admin delete car profiles" on public.car_profiles
  for delete to authenticated
  using (public.is_admin());

-- ---- robot user settings (per-user robot preferences) ---------------
drop policy if exists "staff read robot settings" on public.robot_user_settings;
create policy "staff read robot settings" on public.robot_user_settings
  for select to authenticated
  using (public.is_staff());

drop policy if exists "admin delete robot settings" on public.robot_user_settings;
create policy "admin delete robot settings" on public.robot_user_settings
  for delete to authenticated
  using (public.is_admin());

-- ---- crash reports --------------------------------------------------
drop policy if exists "staff read crash reports" on public.device_crash_reports;
create policy "staff read crash reports" on public.device_crash_reports
  for select to authenticated
  using (public.is_staff());

drop policy if exists "admin delete crash reports" on public.device_crash_reports;
create policy "admin delete crash reports" on public.device_crash_reports
  for delete to authenticated
  using (public.is_admin());

-- ---- app logs -------------------------------------------------------
-- app_logs already has "staff delete app logs"; add the matching read policy
-- and an explicit admin delete so the intent is readable in the policy list.
drop policy if exists "staff read app logs" on public.app_logs;
create policy "staff read app logs" on public.app_logs
  for select to authenticated
  using (public.is_staff());

drop policy if exists "admin delete app logs" on public.app_logs;
create policy "admin delete app logs" on public.app_logs
  for delete to authenticated
  using (public.is_admin());
