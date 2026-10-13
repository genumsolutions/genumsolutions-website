-- Phase 7c (U-108): Fresh-start DB cleanup + retention
-- Owner round 4 / Phase 7c. This migration wipes the specific car (board_id
-- '1FB608') + the owner's car-related rows from the DB, and adds retention
-- policies for device_crash_reports and app_logs.
--
-- HOW TO APPLY:
--   1. Replace OWNER_USER_ID below with your actual auth.users.id (from
--      Supabase Dashboard → Authentication → Users → Copy ID).
--   2. Run this entire file in the Supabase SQL Editor.
--   3. The migration is idempotent - re-running is safe.
--
-- WHAT IT DELETES:
--   • device_crash_reports WHERE board_id = '1FB608'
--   • car_profiles WHERE profile_key ILIKE 'fw:1FB608%'
--   • user_devices WHERE device_id = (SELECT id FROM devices WHERE unique_id = 'fw:1FB608')
--   • devices WHERE unique_id = 'fw:1FB608'
--   • device_relay_tokens WHERE device_id = (SELECT id FROM devices WHERE unique_id = 'fw:1FB608')
--   • app_logs WHERE user_id = OWNER_USER_ID
--
-- RETENTION ADDED:
--   • device_crash_reports: delete rows older than 30 days (function provided)
--   • app_logs: delete rows older than 30 days (function provided)

-- =====================================================================
-- USER CONFIGURATION — REPLACE WITH YOUR ACTUAL USER ID
-- =====================================================================
-- Get your user_id from: Supabase Dashboard → Authentication → Users → Copy ID
-- Example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
DO $$
DECLARE
    owner_user_id uuid := '00000000-0000-0000-0000-000000000000'; -- REPLACE THIS
BEGIN
    -- ================================================================
    -- 1. FRESH-START DELETE: this car + owner's car-related rows
    -- ================================================================

    -- Delete crash reports for this car
    DELETE FROM public.device_crash_reports
    WHERE board_id = '1FB608';

    -- Delete car profiles for this car (profile_key starts with 'fw:1FB608')
    DELETE FROM public.car_profiles
    WHERE profile_key ILIKE 'fw:1FB608%';

    -- Delete user_devices link for this car
    DELETE FROM public.user_devices
    WHERE device_id = (
        SELECT id FROM public.devices WHERE unique_id = 'fw:1FB608'
    );

    -- Delete the device row itself (cascades to device_relay_tokens via FK)
    DELETE FROM public.devices
    WHERE unique_id = 'fw:1FB608';

    -- Delete the owner's app logs
    DELETE FROM public.app_logs
    WHERE user_id = owner_user_id;

    RAISE NOTICE 'Fresh-start cleanup complete for board_id=1FB608, user_id=%', owner_user_id;
END $$;

-- =====================================================================
-- 2. RETENTION: delete old crash reports and app logs (older than 30 days)
-- =====================================================================

-- Retention function for device_crash_reports
CREATE OR REPLACE FUNCTION public.purge_old_crash_reports()
RETURNS integer
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    deleted_count integer;
BEGIN
    DELETE FROM public.device_crash_reports
    WHERE reported_at < now() - interval '30 days';
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;

-- Retention function for app_logs
CREATE OR REPLACE FUNCTION public.purge_old_app_logs()
RETURNS integer
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    deleted_count integer;
BEGIN
    DELETE FROM public.app_logs
    WHERE created_at < now() - interval '30 days';
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;

-- Grant execute to authenticated (service role bypasses RLS anyway)
GRANT EXECUTE ON FUNCTION public.purge_old_crash_reports() TO authenticated;
GRANT EXECUTE ON FUNCTION public.purge_old_app_logs() TO authenticated;

-- =====================================================================
-- 3. OPTIONAL: pg_cron schedule (uncomment if pg_cron extension is enabled)
-- =====================================================================
-- SELECT cron.schedule('purge-old-crash-reports', '0 3 * * *', 'SELECT public.purge_old_crash_reports();');
-- SELECT cron.schedule('purge-old-app-logs', '0 3 * * *', 'SELECT public.purge_old_app_logs();');

-- =====================================================================
-- COMMENTS
-- =====================================================================
COMMENT ON FUNCTION public.purge_old_crash_reports IS
    'Deletes device_crash_reports rows older than 30 days. Call manually or schedule via pg_cron.';
COMMENT ON FUNCTION public.purge_old_app_logs IS
    'Deletes app_logs rows older than 30 days. Call manually or schedule via pg_cron.';

-- =====================================================================
-- VERIFICATION QUERIES (run after migration to confirm)
-- =====================================================================
-- SELECT count(*) FROM public.device_crash_reports WHERE board_id = '1FB608'; -- should be 0
-- SELECT count(*) FROM public.car_profiles WHERE profile_key ILIKE 'fw:1FB608%'; -- should be 0
-- SELECT count(*) FROM public.devices WHERE unique_id = 'fw:1FB608'; -- should be 0
-- SELECT count(*) FROM public.app_logs WHERE user_id = 'YOUR_USER_ID_HERE'; -- should be 0
-- SELECT public.purge_old_crash_reports(); -- test retention function
-- SELECT public.purge_old_app_logs(); -- test retention function