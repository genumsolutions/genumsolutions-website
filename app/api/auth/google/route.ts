import { NextResponse, type NextRequest } from "next/server";
import { createClient, supabaseConfigured } from "../../../../lib/supabase/server";

// Starts Google sign-in/up: bounces the visitor to Google, then back to /auth/callback.
// Optional ?next=/path controls where the callback sends them afterwards.
//
// One code path for both forms: a Google identity that has no account yet IS a
// registration (Google has already verified the address). Nothing here needs
// to know which form the visitor used, and no account is ever created only to
// be deleted again.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  if (!supabaseConfigured()) return NextResponse.redirect(`${origin}/login?error=config`);

  const rawNext = searchParams.get("next") || "/account";
  const next = /^\/[^/\\]/.test(rawNext) ? rawNext : "/account";

  try {
    // Prefer the public site URL when set (Vercel preview/proxy hosts can
    // otherwise produce an internal origin); fall back to request origin.
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
    let callbackOrigin = origin;
    if (siteUrl) {
      try {
        callbackOrigin = new URL(siteUrl).origin;
      } catch {
        callbackOrigin = origin;
      }
    }
    const { data, error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${callbackOrigin}/auth/callback?next=${encodeURIComponent(next)}`,
        // Always show Google's account chooser so a user with several Google
        // accounts can pick the right one instead of dropping silently into a
        // previously signed-in session.
        queryParams: { prompt: "select_account" },
        skipBrowserRedirect: false,
      },
    });
    if (error || !data.url) return NextResponse.redirect(`${origin}/login?error=google`);
    return NextResponse.redirect(data.url);
  } catch {
    return NextResponse.redirect(`${origin}/login?error=config`);
  }
}
