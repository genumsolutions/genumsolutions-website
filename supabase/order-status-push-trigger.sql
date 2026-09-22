-- =====================================================================
-- order-status-push-trigger.sql
--
-- Fires the supabase/functions/push-order-status edge function whenever an
-- order's status changes, so the buyer gets a push notification regardless
-- of whether the update came from the website admin, the app admin, or a
-- payment callback.
--
-- Applied 2026-09-22 (U-5, commit b7a72b0). pg_net enabled, function
-- URL: https://bkylfnlybtsujwzru.supabase.co/functions/v1/push-order-status.
-- Secret gate: PUSH_TRIGGER_SECRET (x-push-secret header).
-- Idempotent: safe to re-run.
-- =====================================================================

-- 1) Async HTTP client (no-op if already enabled).
create extension if not exists pg_net;

-- 2) Trigger function: posts { orderId, status, userId } to the edge fn.
create or replace function public.notify_order_status_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  fn_url text := 'https://bkylfnlybtsujwzru.supabase.co/functions/v1/push-order-status';
  -- The Supabase gateway REQUIRES an Authorization header on every function
  -- call; the public anon key satisfies it. The function's real gate is the
  -- x-push-secret below (matched against the PUSH_TRIGGER_SECRET function
  -- secret) — never drop that header.
  headers jsonb := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJreWxmbmx5YnRzdWp3enJvcHJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MDE5NjksImV4cCI6MjEwMzA3Nzk2OX0.M-FOzaR4P1p-AHweG60n5STGpJRgbwdgodAcenMr0IQ',
    'x-push-secret', '70c344d853bdcd7065ea34c5793b04ab01470c49951ae80c3f2b95a3f288c830'
  );
  payload jsonb := jsonb_build_object(
    'orderId', new.id,
    'status', new.status,
    'userId', new.user_id
  );
begin
  -- Guest/checkout orders have no account — nothing to notify.
  if new.user_id is null then
    return new;
  end if;

  perform net.http_post(
    url := fn_url,
    headers := headers,
    body := payload,
    timeout_milliseconds := 5000
  );
  return new;
end;
$$;

-- 3) Fire only when the status column actually changes.
drop trigger if exists order_status_push on public.orders;
create trigger order_status_push
after update of status on public.orders
for each row
when (new.status is distinct from old.status)
execute function public.notify_order_status_push();
