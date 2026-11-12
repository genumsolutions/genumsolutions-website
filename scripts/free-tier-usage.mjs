#!/usr/bin/env node
// =====================================================================
// Free-tier usage vs the Supabase Free ceilings.
//
// Everything here runs on free plans, and the one limit that actually bites
// production is auth email: 2 per hour on the built-in sender. This prints the
// live numbers next to the ceiling so nobody has to guess, and calls out the
// email cap explicitly because it fails registration (not just a warning).
//
//   npm run limits
//
// Needs (from .env.local or the environment):
//   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_ACCESS_TOKEN   (SQL + auth config)
// =====================================================================
import { readFileSync } from "node:fs";

const CEILINGS = {
  dbMb: 500, // Supabase Free database size
  storageMb: 1024, // Supabase Free file storage
  mau: 50_000, // Supabase Free monthly active users
  emailsPerHour: 2, // built-in sender; only custom SMTP lifts this
};

function env() {
  const out = { ...process.env };
  try {
    for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
      const m = /^([A-Z0-9_]+)=(.*)$/.exec(line);
      if (m && !out[m[1]]) out[m[1]] = m[2].replace(/^"|"$/g, "");
    }
  } catch {
    // No .env.local: rely on the environment.
  }
  return out;
}

const envVars = env();
const url = envVars.NEXT_PUBLIC_SUPABASE_URL;
const token = envVars.SUPABASE_ACCESS_TOKEN;
if (!url || !token) {
  console.error("Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_ACCESS_TOKEN (env or .env.local).");
  process.exit(1);
}
const ref = new URL(url).host.split(".")[0];
const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

async function sql(query) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers,
    body: JSON.stringify({ query }),
  });
  if (!response.ok) throw new Error(`SQL ${response.status}: ${(await response.text()).slice(0, 200)}`);
  return response.json();
}

const bar = (used, ceiling) => {
  const pct = (used / ceiling) * 100;
  const filled = Math.min(10, Math.round(pct / 10));
  return `${"#".repeat(filled)}${".".repeat(10 - filled)} ${pct.toFixed(1)}%`;
};

const row = (label, used, ceiling, unit) =>
  console.log(
    `  ${label.padEnd(22)} ${String(used).padStart(7)} / ${String(ceiling).padStart(7)} ${unit.padEnd(8)} ${bar(used, ceiling)}`
  );

const dbBytes = (await sql("select pg_database_size(current_database()) as b"))[0].b;
const storage = (
  await sql(
    `select coalesce(sum((metadata->>'size')::bigint), 0) as b, count(*)::int as n
       from storage.objects`
  )
)[0];
const users = (await sql("select count(*)::int as n from auth.users"))[0].n;
const buckets = await sql(
  `select bucket_id, count(*)::int as objects,
          round(sum((metadata->>'size')::bigint) / 1048576.0, 1) as mb
     from storage.objects group by bucket_id order by 3 desc nulls last`
);
const auth = await (
  await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, { headers })
).json();

console.log(`\nSupabase Free usage - project ${ref}\n`);
row("Database", Math.round(dbBytes / 1048576), CEILINGS.dbMb, "MB");
row("Storage", Math.round(storage.b / 1048576), CEILINGS.storageMb, "MB");
row("Auth users (MAU)", users, CEILINGS.mau, "users");
console.log(`\n  Storage by bucket:`);
for (const b of buckets) console.log(`    ${b.bucket_id.padEnd(18)} ${String(b.objects).padStart(4)} objects ${String(b.mb).padStart(8)} MB`);

const emailCap = auth.rate_limit_email_sent;
console.log(`\n  Auth email            ${emailCap}/hour  ${auth.smtp_host ? "custom SMTP" : "BUILT-IN sender"}`);
if (!auth.smtp_host) {
  console.log(
    `  ! Without custom SMTP the ${emailCap}/hour cap cannot be raised: registrations past\n` +
      `    ${emailCap} in one hour fail with "Could not register. Try again." Add SMTP in\n` +
      `    Authentication -> Emails to lift it (see TRACKS/AUTH-REGISTRATION.md).`
  );
}
console.log(`  Confirmation required  ${auth.mailer_autoconfirm ? "no (auto-confirm)" : "yes"}`);
console.log(`  Other auth limits      signup/verify ${auth.rate_limit_verify}/5min, refresh ${auth.rate_limit_token_refresh}/5min\n`);
