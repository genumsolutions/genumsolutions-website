#!/usr/bin/env bash
# Apply the logs+profiles migration to the live Supabase project via the
# Supabase Management API (not the JS schema cache).
#
# Requires: SUPABASE_ACCESS_TOKEN in the environment (from .env.local).
# Project ref is hardcoded to the verified project: jxgmbodzkmxanuwfaqxo
#
# Status on this project from this environment:
#   POST /v1/projects/jxgmbodzkmxanuwfaqxo/sql returned HTTP 404 here, so this
#   path is NOT usable from here. The script is kept only as a documented
#   artifact and a fallback if that endpoint becomes reachable.
#
# Usable apply paths instead:
#   - Supabase Dashboard SQL Editor: paste supabase/migrations/20261108_user_logs_profiles.sql
#   - npm run db:apply   (needs SUPABASE_DB_URL in .env.local)
#   - CI with direct DB credentials
#
# Usage (if the endpoint is reachable):
#   cd genumsolutions-website
#   source .env.local  # or export SUPABASE_ACCESS_TOKEN=... first
#   bash scripts/apply-migration-via-api.sh

set -euo pipefail

PROJECT_REF="jxgmbodzkmxanuwfaqxo"
MIGRATION_FILE="supabase/migrations/20261108_user_logs_profiles.sql"

if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ]; then
  echo "Missing SUPABASE_ACCESS_TOKEN. Set it or source .env.local first." >&2
  exit 2
fi

base="https://api.supabase.com/v1/projects/${PROJECT_REF}"

# 1) Read the migration file and POST it to the managed SQL endpoint.
#    Endpoint: POST /v1/projects/:ref/sql
echo "Applying migration file: ${MIGRATION_FILE}"

# NOTE: a stray leading space on this line previously caused a shell error.
MigrationSQL=$(cat "${MIGRATION_FILE}")

http_code=$(curl -sS -o /dev/null -w "%{http_code}" \
  -X POST "${base}/sql" \
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
  -H "Content-Type: application/sql" \
  -d "${MigrationSQL}")

if [ "${http_code}" != "200" ]; then
  echo "Migration SQL endpoint returned HTTP ${http_code}; aborting without changing anything." >&2
  echo "Tip: if you want the migration body dumped for the Dashboard SQL Editor," \
       "run this script with --print-body first." >&2
  exit 1
fi

echo "Migration SQL accepted (HTTP ${http_code})."

# 2) Quick verify via the same managed SQL endpoint:
#    SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename IN (...);
echo "Verifying tables now exist in public schema..."
verify_sql="SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename IN ('user_activity_log','user_profile_entries','profile_entry_types');"
verify=$(curl -sS \
  -X POST "${base}/sql" \
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
  -H "Content-Type: application/sql" \
  -d "${verify_sql}")

echo "Verify result:"
echo "${verify}"

# 3) Row counts, to confirm the tables are not just present-but-empty
echo "Row counts after apply:"
count_sql="
SELECT
  'user_activity_log' AS tbl, count(*)::int AS cnt FROM public.user_activity_log
UNION ALL
SELECT 'user_profile_entries', count(*)::int FROM public.user_profile_entries
UNION ALL
SELECT 'profile_entry_types', count(*)::int FROM public.profile_entry_types;
"
curl -sS \
  -X POST "${base}/sql" \
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
  -H "Content-Type: application/sql" \
  -d "${count_sql}"

echo ""
echo "Done."
