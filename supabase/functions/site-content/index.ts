import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const supabaseUrl = Deno.env.get("NEXT_PUBLIC_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceKey =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY") ?? "";

const supabase = createClient(supabaseUrl, supabaseServiceKey!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

serve(async (req) => {
  const url = new URL(req.url);

  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  try {
    const body = await req.json();
    const action = body.action;

    if (action === "get") {
      // R6 fix: single() resolves to { data, error } — it is NOT iterable, so
      // the old `const [{ data }] =` destructure threw "is not iterable" on
      // every request (seen as WORKER_ERROR in production). Read the result
      // object directly instead.
      const { data, error } = await supabase.from("site_content").select("*").eq("id", 1).single();
      if (error) console.error("site_content read failed:", error.message);
      if (data)
        return new Response(JSON.stringify({ content: data }), {
          headers: { "Content-Type": "application/json" },
          status: 200,
        });
      // Return defaults if no row exists
      return new Response(
        JSON.stringify({
          content: {
            id: 1,
            home_title: "Technology you can touch, test, and trust.",
            home_body:
              "Robotics kits, project solutions, fabrication, open tools, and training for curious builders, schools, and teams.",
            updated_at: new Date().toISOString(),
          },
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    if (action === "upsert") {
      // U-48 (2026-09-27) SECURITY: this action used to run with the SERVICE
      // ROLE key and NO caller check at all, so any anonymous caller could
      // rewrite the whole site_content row (defacement + free resource abuse).
      // It is now gated exactly like the other service-role edge functions
      // (admin-products / admin-set-role): resolve the CALLER's bearer token,
      // then require an admin/owner profile. The "get" action above stays
      // public on purpose - the home hero text is public content.
      const authHeader = req.headers.get("Authorization") || "";
      const callerToken = authHeader.replace(/^Bearer\s+/i, "");
      if (!callerToken) {
        return new Response(JSON.stringify({ error: "Sign in to edit site content." }), {
          headers: { "Content-Type": "application/json" },
          status: 401,
        });
      }

      const { data: userData, error: userError } = await supabase.auth.getUser(callerToken);
      const callerId = userData?.user?.id;
      if (userError || !callerId) {
        return new Response(JSON.stringify({ error: "Sign in to edit site content." }), {
          headers: { "Content-Type": "application/json" },
          status: 401,
        });
      }

      const { data: callerProfile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", callerId)
        .maybeSingle();
      if (callerProfile?.role !== "admin" && callerProfile?.role !== "owner") {
        return new Response(JSON.stringify({ error: "Only admins can edit site content." }), {
          headers: { "Content-Type": "application/json" },
          status: 403,
        });
      }

      const { content } = body;
      if (!content?.id) {
        return new Response(JSON.stringify({ error: "Content needs id" }), {
          headers: { "Content-Type": "application/json" },
          status: 400,
        });
      }
      const payload = { ...content, updated_at: new Date().toISOString() };
      const { data, error } = await supabase.from("site_content").upsert(payload).select();
      if (error) throw error;
      return new Response(JSON.stringify({ content: data[0] }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      headers: { "Content-Type": "application/json" },
      status: 404,
    });
  } catch (error) {
    console.error("Site content Edge Function error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});
