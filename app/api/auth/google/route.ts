import { NextResponse, type NextRequest } from "next/server";
import { createClient, supabaseConfigured } from "../../../../lib/supabase/server";

// Starts Google sign-in/up: bounces the visitor to Google, then back to /auth/callback.
// Optional ?next=/path controls where the callback sends them afterwards.
//
// ?intent=signup is only set by the sign-up form's "Sign up with Google".
// Every other entry point (the sign-in form) is intent=signin, and the callback
// refuses to let it create an account - see app/auth/callback/route.ts.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  if (!supabaseConfigured()) return NextResponse.redirect(`${origin}/login?error=config`);

  const rawIntent = searchParams.get("intent");
  const intent = rawIntent === "signup" || rawIntent === "register" ? "signup" : "signin";
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
    const response = NextResponse.redirect(data.url);
    // Short-lived, httpOnly: the callback needs to know whether this trip to
    // Google was a sign-up before it can decide what to do with a brand-new
    // row. A cookie is the only channel OAuth leaves us (Supabase cannot attach
    // user metadata to a browser OAuth sign-in).
    response.cookies.set("genum_google_intent", intent, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 600,
      secure: callbackOrigin.startsWith("https"),
    });
    return response;
  } catch {
    return NextResponse.redirect(`${origin}/login?error=config`);
  }
}
