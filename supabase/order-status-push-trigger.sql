-- =====================================================================
-- order-status-push-trigger.sql
--
-- Fires the supabase/functions/push-order-status edge function whenever an
-- order's status changes, so the buyer gets a push notification regardless
-- of whether the update came from the website admin, the app admin, or a
-- payment callback.
--
-- Applied 2026-09-22 (U-5, commit b7a72b0) to the original project
-- `bkylfnlybtsujwzropru`; re-applied 2026-11-07 to the migrated project
-- `jxgmbodzkmxanuwfaqxo` (the old ref no longer resolves).
--
-- NOT a copy-paste file: the two secrets below are placeholders on purpose.
-- The Supabase anon key and PUSH_TRIGGER_SECRET are project-specific, so a
-- hardcoded copy goes stale (and trips the repo's gitleaks job) the moment the
-- project changes. Before running, replace:
--
--   <<ANON_KEY>>             Project Settings -> API -> anon public  (works with
--                            .env.local NEXT_PUBLIC_SUPABASE_ANON_KEY)
--   <<PUSH_TRIGGER_SECRET>>  the PUSH_TRIGGER_SECRET function secret
--                            (works with .env.local PUSH_TRIGGER_SECRET)
--
-- Then run the whole file against the project (SQL editor, or
-- `node -e` with `pg` + .env.local SUPABASE_DB_URL).
--
-- `pg_net` must be enabled on the project (step 1 below does it).
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
  fn_url text := 'https://jxgmbodzkmxanuwfaqxo.supabase.co/functions/v1/push-order-status';
  -- The Supabase gateway REQUIRES an Authorization header on every function
  -- call; the public anon key satisfies it. The function's real gate is the
  -- x-push-secret below (matched against the PUSH_TRIGGER_SECRET function
  -- secret) — never drop that header.
  headers jsonb := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer <<ANON_KEY>>',
    'x-push-secret', '<<PUSH_TRIGGER_SECRET>>'
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
