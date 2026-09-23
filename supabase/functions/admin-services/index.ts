// =====================================================================
// admin-services - shared service CRUD for BOTH clients (app + website).
//
// WHY IT EXISTS: the website writes services via its own Next.js API
// routes (service role, cookie session). The native app has no website
// URL, so it must go through a shared service-role edge function instead
// of a direct anon-key upsert. This function is the app's write path.
//
// TL;DR OF THE 2026-09-23 SECURITY FIX: the previous version performed
// service-role writes with NO caller verification at all — anyone who
// knew the function URL could create/update/delete services. It now
// mirrors the `admin-products` auth pattern exactly: the caller's bearer
// JWT must resolve to a profile with role 'staff' | 'admin' | 'owner'
// for read/write; deletes require 'admin' | 'owner'.
//
// Body (JSON): { action: 'list' | 'create' | 'update' | 'delete' | 'toggle',
//                id?: string, service?: object, currentStatus?: boolean }
//
// Deploy:
//   supabase functions deploy admin-services --project-ref bkylfnlybtsujwzru
//   (uses the project's service role + URL env vars, no extra secrets)
// =====================================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const supabaseUrl = Deno.env.get("NEXT_PUBLIC_SUPABASE_URL") || Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

// Resolve the caller's profile role from their bearer token.
async function callerRole(
  req: Request
): Promise<{ role: string | null; client: ReturnType<typeof createClient>; error?: string }> {
  const authHeader = req.headers.get("Authorization") || "";
  const callerToken = authHeader.replace(/^Bearer\s+/i, "");
  if (!callerToken)
    return {
      role: null,
      client: null as unknown as ReturnType<typeof createClient>,
      error: "Sign in to manage services.",
    };

  const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: userData, error: userError } = await adminClient.auth.getUser(callerToken);
  const callerId = userData?.user?.id;
  if (userError || !callerId)
    return { role: null, client: adminClient, error: "Sign in to manage services." };

  const { data: callerProfile } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", callerId)
    .maybeSingle();
  if (!callerProfile?.role)
    return { role: null, client: adminClient, error: "Only staff members can manage services." };
  return { role: String(callerProfile.role), client: adminClient };
}

function isStaff(role: string | null) {
  return role === "staff" || role === "admin" || role === "owner";
}
function isAdmin(role: string | null) {
  return role === "admin" || role === "owner";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, content-type, apikey",
      },
    });
  }

  try {
    const { role, client, error } = await callerRole(req);
    if (error || !client) return json({ error: error || "Sign in to manage services." }, 401);
    if (!isStaff(role)) return json({ error: "Only staff members can manage services." }, 403);

    const body = await req.json().catch(() => null);
    const action = String(body?.action || "");

    // Shared id sanitizer (matches the website route + app editor).
    const slugify = (raw: string) =>
      String(raw).trim().toLowerCase().replace(/\s+/g, "-").slice(0, 120);

    if (action === "list") {
      const { data, error: listError } = await client
        .from("services")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      if (listError) throw listError;
      return json({ services: data });
    }

    if (action === "create" || action === "update") {
      const service = body?.service ?? null;
      const id = slugify(String(service?.id || body?.id || ""));
      if (!id || !service?.name) {
        return json({ error: "Service needs id and name." }, 400);
      }
      if (!/^[a-z0-9-]+$/.test(id)) {
        return json({ error: "Service id must be alphanumeric with dashes only." }, 400);
      }
      const payload = { ...service, id, updated_at: new Date().toISOString() };
      const { data, error: upsertError } = await client.from("services").upsert(payload).select();
      if (upsertError) throw upsertError;
      return json({ service: data?.[0] ?? payload }, action === "create" ? 201 : 200);
    }

    if (action === "delete") {
      if (!isAdmin(role)) return json({ error: "Only administrators can delete services." }, 403);
      const id = String(body?.id || "");
      if (!id) return json({ error: "Missing id" }, 400);
      const { error: deleteError } = await client.from("services").delete().eq("id", id);
      if (deleteError) throw deleteError;
      return json({ deleted: true });
    }

    if (action === "toggle") {
      const id = String(body?.id || "");
      if (!id) return json({ error: "Missing id" }, 400);
      const current = body?.currentStatus === true;
      const { data, error: toggleError } = await client
        .from("services")
        .update({ active: !current })
        .eq("id", id)
        .select();
      if (toggleError) throw toggleError;
      return json({ service: data?.[0] ?? null, active: data?.[0]?.active ?? !current });
    }

    return json({ error: "Unknown action." }, 404);
  } catch (error) {
    console.error("admin-services error:", error);
    return json({ error: error instanceof Error ? error.message : "Internal error" }, 500);
  }
});
