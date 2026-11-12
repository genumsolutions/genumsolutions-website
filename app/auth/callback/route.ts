import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { createClient, createServiceClient } from "../../../lib/supabase/server";
import { enforceSingleSession } from "../../../lib/single-session";

function redirectWithCookies(url: string) {
  const response = NextResponse.redirect(url);
  try {
    for (const cookie of cookies().getAll()) response.cookies.set(cookie);
  } catch {
    // Best effort: the redirect still happens.
  }
  return response;
}

/**
 * A Google trip started from the SIGN-IN form must never create an account.
 * Supabase cannot attach metadata to a browser OAuth sign-in, so the intent is
 * carried in a cookie and the brand-new row is removed here instead. Existing
 * accounts are unaffected (their created_at is older than the window), and
 * "Sign up with Google" carries intent=signup so it may create one.
 */
async function rejectUnregisteredGoogleUser(
  userId: string,
  createdAt: string | undefined,
  intent: string
): Promise<boolean> {
  if (intent === "signup") return false;
  const age = Date.now() - new Date(createdAt || 0).getTime();
  if (!Number.isFinite(age) || age > 5 * 60_000) return false;
  try {
    await createServiceClient().auth.admin.deleteUser(userId);
    return true;
  } catch {
    // If the delete fails the row stays, but the visitor is still told to
    // register - never hand out a session for an unregistered Google sign-in.
    return true;
  }
}

// Supabase redirects here after Google OAuth sign-in and password-recovery emails.
// Handles the PKCE ?code= flow and the legacy token_hash email-link format.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const googleIntent = request.cookies.get("genum_google_intent")?.value || "signin";

  // GoTrue can send failures as query params (error + error_description).
  // Forward both to the login page so the real reason is visible instead of
  // a generic "email link invalid" message.
  const oauthError = searchParams.get("error");
  if (oauthError && !code && !tokenHash) {
    const detail = searchParams.get("error_description") || searchParams.get("error_code") || "";
    console.error("[auth/callback] OAuth error from provider:", oauthError, detail);
    const params = new URLSearchParams({ error: "google", detail });
    const res = redirectWithCookies(`${origin}/login?${params.toString()}`);
    res.cookies.delete("genum_google_intent");
    return res;
  }

  // Only allow relative next paths to avoid open redirects.
  // Supabase double-encodes `next` inside redirect_to, so decode once first.
  let rawNext = searchParams.get("next") || "/reset-password";
  try {
    const decoded = decodeURIComponent(rawNext);
    if (decoded) rawNext = decoded;
  } catch {
    // Malformed encoding: keep raw, validation below will reject it.
  }
  // Landing by flow: OAuth and a confirmed registration land on /account (the
  // registration email is the first sign-in, so it must not dead-end on a
  // password-reset form); password recovery still lands on /reset-password.
  const fallback =
    code || type === "signup" || type === "invite" || type === "magiclink"
      ? "/account?welcome=1"
      : "/reset-password";
  if (!searchParams.get("next")) rawNext = fallback;
  const next = /^\/[^/\\]/.test(rawNext) ? rawNext : fallback;

  try {
    const supabase = createClient();
    if (code) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        if (
          data.user?.id &&
          (await rejectUnregisteredGoogleUser(data.user.id, data.user.created_at, googleIntent))
        ) {
          // Drop the session cookies exchangeCodeForSession just wrote so the
          // rejected Google sign-in never looks logged in, even briefly.
          await supabase.auth.signOut().catch(() => {});
          const refused = redirectWithCookies(`${origin}/login?error=no_account`);
          refused.cookies.delete("genum_google_intent");
          return refused;
        }
        if (data.user?.id) void enforceSingleSession(data.user.id);
        const done = redirectWithCookies(`${origin}${next}`);
        done.cookies.delete("genum_google_intent");
        return done;
      }
      console.error(
        "[auth/callback] code exchange failed:",
        error?.name,
        error?.message,
        error?.status
      );
      const detail = error?.message || "";
      const params = new URLSearchParams({ error: "google", detail });
      return redirectWithCookies(`${origin}/login?${params.toString()}`);
    } else if (
      tokenHash &&
      (type === "recovery" || type === "signup" || type === "invite" || type === "magiclink")
    ) {
      const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
      if (!error) {
        if (data.user?.id) void enforceSingleSession(data.user.id);
        return redirectWithCookies(`${origin}${next}`);
      }
    }
  } catch {
    // Unconfigured Supabase or network hiccup - fall through to the failure redirect.
  }
  return redirectWithCookies(`${origin}/login?error=link`);
}
