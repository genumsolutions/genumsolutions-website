import { NextResponse } from "next/server";
import { createClient as createRawClient } from "@supabase/supabase-js";
import { supabaseConfigured, createServiceClient } from "../../../../../lib/supabase/server";
import { checkRateLimit } from "../../../../../lib/rate-limit";

// Undoes a Google account that the SIGN-IN form created a moment ago.
//
// The app cannot enforce "Google sign-in never registers" on its own: by the
// time it has a session, Supabase has already inserted the row. The app detects
// a just-created account, sends its own access token here, and this route - the
// only place with a service key - removes the row it was asked about.
//
// Scope is deliberately tiny: the caller can only delete their own account, and
// only when it is a Google account created in the last five minutes. Existing
// accounts are answered with {created:false} and left alone.
const FRESH_WINDOW_MS = 5 * 60_000;

export async function POST(request: Request) {
  if (!supabaseConfigured())
    return NextResponse.json({ error: "Accounts are not configured." }, { status: 503 });

  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return NextResponse.json({ error: "Missing session." }, { status: 401 });

  try {
    const userClient = createRawClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    // Validated against the auth server, not decoded locally: a forged token
    // cannot name somebody else's account.
    const { data, error } = await userClient.auth.getUser(token);
    const user = data?.user;
    if (error || !user) return NextResponse.json({ error: "Invalid session." }, { status: 401 });

    const limit = checkRateLimit(`google-fresh:${user.id}`, 3, 60_000);
    if (!limit.allowed) return NextResponse.json({ created: false }, { status: 429 });

    const providers = [
      (user.app_metadata as Record<string, unknown> | undefined)?.provider,
      ...(((user.app_metadata as Record<string, unknown> | undefined)?.providers as
        string[] | undefined) ?? []),
    ];
    const age = Date.now() - new Date(user.created_at || 0).getTime();
    const isFreshGoogle = providers.includes("google") && age <= FRESH_WINDOW_MS;
    if (!isFreshGoogle) return NextResponse.json({ created: false });

    try {
      await createServiceClient().auth.admin.deleteUser(user.id);
    } catch {
      // The row stays behind, but the caller is still told not to keep the
      // session: an unregistered Google sign-in must not feel like success.
    }
    return NextResponse.json({ created: true });
  } catch {
    return NextResponse.json({ created: false }, { status: 503 });
  }
}
