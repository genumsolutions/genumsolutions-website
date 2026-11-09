#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

URL="${NEXT_PUBLIC_SUPABASE_URL:-}"
ANON="${NEXT_PUBLIC_SUPABASE_ANON_KEY:-}"
SVC="${SUPABASE_SERVICE_ROLE_KEY:-}"

if [ -z "$URL" ] || [ -z "$ANON" ] || [ -z "$SVC" ]; then
  echo "admin-api-probe: missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY" >&2
  echo "  Expected in genumsolutions-website/.env.local (gitignored; not stored in this script)." >&2
  exit 2
fi

# If PROBE_VERCEL=1, probe the published Vercel site instead of the Supabase
# project host. Credentials still come from the environment.
ENDPOINTS=(
  /api/admin/logs
  /api/admin/logs?table=user_activity_log
  /api/admin/logs?table=user_profile_entries
  /api/admin/profile-entries
  /api/admin/content
  /api/admin/activity
  /api/admin/analytics
  /api/admin/orders
  /api/admin/products
  /api/admin/users
  /api/admin/messages
  /api/admin/settings
  /api/admin/car-modes
  /api/admin/car-profiles
)

# One inline probe target is enough per run; if you want both hosts compared,
# run the script twice: once normally (Supabase host) and once with
# PROBE_VERCEL=1 (published Vercel site).
if [ "${PROBE_VERCEL:-}" = "1" ]; then
  SITE="${NEXT_PUBLIC_SITE_URL:-}"
  if [ -z "$SITE" ]; then
    echo "admin-api-probe: PROBE_VERCEL=1 but NEXT_PUBLIC_SITE_URL is empty." >&2
    exit 2
  fi
  echo "admin-api-probe: probing ${SITE} with published admin REST endpoints (PROBE_VERCEL=1)"
  echo "-----------------------------------------------------------------------------"
  export PROBE_BASE="${SITE}"
else
  echo "admin-api-probe: probing ${URL} with published admin REST endpoints"
  echo "-----------------------------------------------------------------------------"
  export PROBE_BASE="${URL}"
fi

: "${PROBE_BASE:?PROBE_BASE is unset}"
: "${ENDPOINTS:?ENDPOINTS is unset}"


export PROBE_ENDPOINTS="${ENDPOINTS[*]:-}"

npx tsx <<'TSX'
const url = process.env.PROBE_BASE;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
const endpoints = (process.env.PROBE_ENDPOINTS || '').split(/\s+/).filter(Boolean);
if(!url||!anon||!svc){ console.error('missing credentials'); process.exit(2); }
if(!endpoints.length){ console.error('missing endpoints'); process.exit(2); }
async function probe(key, path){
  const H = { 'apikey': key, 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' };
  const r = await fetch(url+path, {method:'GET', headers:H, redirect:'manual'});
  const b = await r.text();
  try { return {ok: r.ok, key: key===anon?'anon':'svc', path, status:r.status, body: JSON.parse(b)}; }
  catch { return {ok: r.ok, key: key===anon?'anon':'svc', path, status:r.status, body: b.slice(0,600)}; }
}
Promise.all(endpoints.map(p=>probe(anon,p))).then(results=>{
  let anyDown=false;
  results.forEach(r=>{
    if(!r.ok) anyDown=true;
    console.log(r.key+' '+r.path+' -> HTTP '+r.status+' | '+JSON.stringify(r.body).slice(0,400));
  });
  process.exit(anyDown?1:0);
}).catch(e=>{ console.error('probe threw:', e && (e.message || e)); process.exit(3); });
TSX
