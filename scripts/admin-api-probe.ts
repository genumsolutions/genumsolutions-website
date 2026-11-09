/**
 * One-off probe for the website's published admin APIs.
 *
 * By default it talks directly to the live Supabase project host
 * (NEXT_PUBLIC_SUPABASE_URL) using the anon key and reports the HTTP status
 * and body from each published admin endpoint. It does NOT go through the
 * Supabase JS client's schema cache, so it reflects what the project host
 * actually exposes.
 *
 * To probe the published Vercel site instead, set:
 *   PROBE_VERCEL=1 NEXT_PUBLIC_SITE_URL=https://genumsolutions-website.vercel.app \
 *     NEXT_PUBLIC_SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     npx tsx scripts/admin-api-probe.ts
 *
 * Credentials are read from environment variables only. The file does NOT store
 * any real key; it bails out when a required credential is a placeholder.
 */
import { createClient } from "@supabase/supabase-js";

function env(name: string, fallback?: string): string {
  const raw = process.env[name];
  if (raw && raw !== "undefined" && !raw.startsWith("replace") && !raw.includes("replace_with"))
    return raw;
  if (fallback && fallback !== "replace_me" && !fallback.startsWith("replace")) return fallback;
  throw new Error(`${name} is missing or a placeholder.`);
}

const url = env("NEXT_PUBLIC_SUPABASE_URL", "https://jxgmbodzkmxanuwfaqxo.supabase.co");
const anonKey = env("NEXT_PUBLIC_SUPABASE_ANON_KEY");

if (!url || url.startsWith("replace") || url.includes("replace_with")) {
  console.error("NEXT_PUBLIC_SUPABASE_URL is missing or placeholder.");
  process.exit(2);
}
if (!anonKey || anonKey.startsWith("replace") || anonKey === "undefined") {
  console.error("NEXT_PUBLIC_SUPABASE_ANON_KEY is missing or placeholder.");
  process.exit(2);
}

const anonClient = createClient(url, anonKey, {
  auth: { persistSession: false },
});

type ProbeResult =
  { ok: true; status: number; body: unknown } | { ok: false; status: number; text: string };

async function probe(
  key: string,
  path: string,
  baseUrl?: string,
  extraHeaders?: Record<string, string>
): Promise<ProbeResult> {
  const base = baseUrl && baseUrl !== url ? baseUrl : url;
  const headers: Record<string, string> = {
    apikey: key,
    Authorization: "Bearer " + key,
    "Content-Type": "application/json",
  };
  if (extraHeaders) Object.assign(headers, extraHeaders);
  const res = await fetch(base + path, { method: "GET", headers, redirect: "manual" });
  const text = await res.text();
  if (res.ok) {
    try {
      const json = JSON.parse(text);
      return { ok: true, status: res.status, body: json };
    } catch {
      return { ok: true, status: res.status, body: text.slice(0, 600) };
    }
  }
  return { ok: false, status: res.status, text: text };
}

const productionBaseUrl = env("NEXT_PUBLIC_SITE_URL", "https://genumsolutions-website.vercel.app");
const productionBase = productionBaseUrl.replace(/\/?$/, "");

const endpoints = [
  "/api/admin/logs",
  "/api/admin/logs?table=user_activity_log",
  "/api/admin/logs?table=user_profile_entries",
  "/api/admin/profile-entries",
  "/api/admin/content",
  "/api/admin/activity",
  "/api/admin/analytics",
  "/api/admin/orders",
  "/api/admin/products",
  "/api/admin/users",
  "/api/admin/messages",
  "/api/admin/settings",
  "/api/admin/car-modes",
  "/api/admin/car-profiles",
];

async function run() {
  let anyDown = false;
  const production = process.env.PROBE_VERCEL === "1";
  const baseForProbe = production ? productionBase : url;
  if (production) console.log("Probing production at " + productionBase + " (PROBE_VERCEL=1).");
  for (const path of endpoints) {
    const result = await probe(anonKey, path, production ? productionBase : undefined);
    if (!result.ok) anyDown = true;
    const short = result.ok ? JSON.stringify(result.body).slice(0, 400) : result.text;
    console.log(`anon ${path} -> HTTP ${result.status} | ${short}`);
  }
  // Probes that skip the apikey header to see if the endpoint exists at all.
  if (production) {
    console.log("--- bare/empty-header probes (no apikey) ---");
    for (const path of endpoints.slice(0, 4)) {
      const result = await probe("", path, production ? productionBase : undefined, {
        Accept: "application/json",
      });
      if (!result.ok) anyDown = true;
      console.log(
        `bare ${path} -> HTTP ${result.status} | ${typeof result.text === "string" ? result.text.slice(0, 220) : JSON.stringify(result.body).slice(0, 220)}`
      );
    }
    const env = {
      HOST: process.env.HOST,
      VERCEL: process.env.VERCEL,
      PROBE_VERCEL: process.env.PROBE_VERCEL,
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    };
    console.log("--- runtime env ---", JSON.stringify(env));
  }
  // Service-role ground truth for the newest tables
  const svcKey = env("SUPABASE_SERVICE_ROLE_KEY");
  if (svcKey && !svcKey.startsWith("replace") && svcKey !== "undefined") {
    const svcEndpoints = [
      "/api/admin/logs?table=user_activity_log",
      "/api/admin/logs?table=user_profile_entries",
      "/api/admin/profile-entries",
      "/api/admin/content",
    ];
    console.log("--- service-role ground truth ---");
    for (const path of svcEndpoints) {
      const result = await probe(svcKey, path, production ? productionBase : undefined);
      if (!result.ok) anyDown = true;
      console.log(
        `svc ${path} -> HTTP ${result.status} | ${typeof result.text === "string" ? result.text.slice(0, 400) : JSON.stringify(result.body).slice(0, 400)}`
      );
    }
  }
  process.exit(anyDown ? 1 : 0);
}

run().catch((e) => {
  console.error("probe threw:", e && (e.message || e));
  process.exit(3);
});
