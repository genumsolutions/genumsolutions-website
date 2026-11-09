#!/usr/bin/env bash
# Documents the reachable vs blocked SQL paths for the live Supabase project
# (jxgmbodzkmxanuwfaqxo), and points to the actual verification artifact.
#
# Verified from this environment:
#   1) Supabase Management API project inspect: reachable (HTTP 200).
#      Region ap-southeast-1, DB host db.jxgmbodzkmxanuwfaqxo.supabase.co:5432, PG17.
#   2) POST /v1/projects/jxgmbodzkmxanuwfaqxo/sql: NOT reachable from here (HTTP 404).
#   3) db.jxgmbodzkmxanuwfaqxo.supabase.co:6543: TLS-serviced from here, but does
#      NOT accept HTTP from here (OpenSSL alert 120, 'no application protocol').
#
# Usable SQL verification path when needed:
#   - Supabase Dashboard SQL Editor -> run scripts/verify-logs-profiles.sql
#   - npm run db:apply + the JS client, once SUPABASE_DB_URL is set
#   - CI with direct DB credentials
#
# The migration that must be applied first:
#   - genumsolutions-website/supabase/migrations/20261108_user_logs_profiles.sql
#   - genumsolutions-website/supabase/schema.sql  (same three-table section appended)
#
# The verification SQL:
#   - scripts/verify-logs-profiles.sql
