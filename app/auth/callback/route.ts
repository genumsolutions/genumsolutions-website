import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "../../../lib/supabase/server";
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

// Supabase redirects here after Google OAuth sign-in and password-recovery emails.
// Handles the PKCE ?code= flow and the legacy token_hash email-link format.
//
// Google is a first-class registration path: an OAuth sign-in for an address
// with no row yet creates the account and signs it in. The site must never
// create-then-delete a "fresh" account to enforce sign-in-only semantics: that
// guard silently removed real sign-ups whenever its intent hint was missing
// (cookie dropped, different host, expired trip), and the account disappeared
// minutes after registration.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  // GoTrue can send failures as query params (error + error_description).
  // Forward both to the login page so the real reason is visible instead of
  // a generic "email link invalid" message.
  const oauthError = searchParams.get("error");
  if (oauthError && !code && !tokenHash) {
    const detail = searchParams.get("error_description") || searchParams.get("error_code") || "";
    console.error("[auth/callback] OAuth error from provider:", oauthError, detail);
    const params = new URLSearchParams({ error: "google", detail });
    return redirectWithCookies(`${origin}/login?${params.toString()}`);
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
        if (data.user?.id) void enforceSingleSession(data.user.id);
        return redirectWithCookies(`${origin}${next}`);
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
