-- Company website URL.
--
-- The app's Settings form has carried a "Website URL" input since U-I6, but
-- company_info never had a column for it: the app read nothing and saved
-- nothing, so the field was decorative. Both consoles now persist it here.
--
-- Idempotent, like the C5 social-column migrations: safe to re-run.

alter table public.company_info
  add column if not exists url text not null default '';
