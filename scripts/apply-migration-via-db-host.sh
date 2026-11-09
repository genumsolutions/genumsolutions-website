#!/usr/bin/env bash
# Apply the logs+profiles migration through the project's DB-host SQL proxy.
#
# Project:  jxgmbodzkmxanuwfaqxo
# Host:     db.jxgmbodzkmxanuwfaqxo.supabase.co:6543
# Auth:     Bearer SUPABASE_ACCESS_TOKEN
# Endpoint: POST /sql
#
# Status on this project from this environment:
#   db.jxgmbodzkmxanuwfaqxo.supabase.co:6543 completes TLS 1.3 here but does
#   NOT accept HTTP from here (OpenSSL 'tlsv1 alert no application protocol',
#   alert 120). Plain POST/GET/OPTIONS to /sql, /sql with body, and even GET /
#   all time out with no response. Raw-socket half-close after 1s also returns
#   nothing. So this path is NOT usable from here.
#
# Usable apply paths instead:
#   - Supabase Dashboard SQL Editor: paste supabase/migrations/20261108_user_logs_profiles.sql
#   - npm run db:apply   (needs SUPABASE_DB_URL in .env.local)
#   - CI with direct DB credentials
#
# Usage (if the endpoint is reachable):
#   export SUPABASE_ACCESS_TOKEN=sbp_...
#   bash scripts/apply-migration-via-db-host.sh

set -euo pipefail

PROJECT_REF="jxgmbodzkmxanuwfaqxo"
DB_HOST="db.jxgmbodzkmxanuwfaqxo.supabase.co"
DB_PORT="6543"
MIGRATION_FILE="supabase/migrations/20261108_user_logs_profiles.sql"

if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ]; then
  echo "Missing SUPABASE_ACCESS_TOKEN. Export it first." >&2
  exit 2
fi

SQL_BASE="https://${DB_HOST}:${DB_PORT}/sql"

if [ ! -f "${MIGRATION_FILE}" ]; then
  echo "Missing migration file: ${MIGRATION_FILE}" >&2
  exit 2
fi

MigrationSQL="$(cat "${MIGRATION_FILE}")"

echo "Applying migration via ${SQL_BASE}..."
http_code=$(curl -sS -o /dev/null -w "%{http_code}" \
  -X POST "${SQL_BASE}" \
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
  -H "Content-Type: application/sql" \
  -d "${MigrationSQL}")

if [ "$http_code" != "200" ]; then
  echo "SQL proxy returned HTTP ${http_code}; aborting without further changes." >&2
  echo "If this is a transient 5xx, re-run the script once more." >&2
  exit 1
fi

echo "Migration SQL accepted (HTTP ${http_code})."

echo "Verifying tables exist in public schema..."
verify_sql="SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename IN ('user_activity_log','user_profile_entries','profile_entry_types') ORDER BY tablename;"
curl -sS \
  -X POST "${SQL_BASE}" \
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
  -H "Content-Type: application/sql" \
  -d "${verify_sql}"
echo ""

echo "Row counts after apply:"
count_sql="
SELECT 'user_activity_log' AS tbl, count(*)::int AS cnt FROM public.user_activity_log
UNION ALL
SELECT 'user_profile_entries', count(*)::int FROM public.user_profile_entries
UNION ALL
SELECT 'profile_entry_types', count(*)::int FROM public.profile_entry_types;
"
curl -sS \
  -X POST "${SQL_BASE}" \
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
  -H "Content-Type: application/sql" \
  -d "${count_sql}"
echo ""

echo "Done."
