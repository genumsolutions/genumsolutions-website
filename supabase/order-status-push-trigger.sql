-- =====================================================================
-- order-status-push-trigger.sql
--
-- Fires the supabase/functions/push-order-status edge function whenever an
-- order's status changes, so the buyer gets a push notification regardless
-- of whether the update came from the website admin, the app admin, or a
-- payment callback.
--
-- How to activate (Supabase dashboard -> SQL editor, once):
--   1. Enable pg_net (it powers the async HTTP call):
--        create extension if not exists pg_net;
--   2. Deploy the edge function first and note its URL:
--        supabase/functions deploy push-order-status
--      Function URL: https://<project-ref>.supabase.co/functions/v1/push-order-status
--   3. Replace <YOUR_PROJECT_REF> below (or the whole URL) with the real
--      function URL, then run this file.
--   4. If you set a PUSH_TRIGGER_SECRET on the function, replace
--      'change-me-shared-secret' below with the same value so the trigger
--      is the only caller the function accepts.
--
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
  fn_url text := 'https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/push-order-status';
  headers jsonb := jsonb_build_object(
    'Content-Type', 'application/json',
    'x-push-secret', 'change-me-shared-secret'
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
