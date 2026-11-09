-- =====================================================================
-- 20261109_user_logs_staff_rls.sql
-- Adds the staff/admin policies the two clients need on top of
-- 20261108_user_logs_profiles.sql.
--
-- Why: the website admin panels read these tables with the service-role key
-- (which bypasses RLS), but the mobile app reads them with the signed-in
-- user's session, exactly like activity_log / device_crash_reports /
-- app_logs. Without a staff read policy the app admin sees zero rows.
--
-- Matches the existing convention in supabase/schema.sql:
--   "staff read <thing>"  -> for select using (public.is_staff())
--   "admin delete <thing>" -> for delete using (public.is_admin())
--
-- Idempotent: safe to re-run.
-- =====================================================================

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

drop policy if exists "staff delete profile entry types" on public.profile_entry_types;
drop policy if exists "admin delete profile entry types" on public.profile_entry_types;
create policy "admin delete profile entry types" on public.profile_entry_types
  for delete to authenticated
  using (public.is_admin());

comment on policy "staff read user activity log" on public.user_activity_log is
  'Admins read every user''s activity log from the app admin panel.';
comment on policy "staff read user profile entries" on public.user_profile_entries is
  'Admins read every user''s profile entries from the app admin panel.';
