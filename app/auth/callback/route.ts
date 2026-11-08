import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "../../../lib/supabase/server";
import { enforceSingleSession } from "../../../lib/single-session";

// Supabase redirects here after Google OAuth sign-in and password-recovery emails.
// Handles the PKCE ?code= flow and the legacy token_hash email-link format.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  // Only allow relative next paths to avoid open redirects.
  // Supabase double-encodes `next` inside redirect_to, so decode once first.
  let rawNext = searchParams.get("next") || "/reset-password";
  try {
    const decoded = decodeURIComponent(rawNext);
    if (decoded) rawNext = decoded;
  } catch {
    // Malformed encoding: keep raw, validation below will reject it.
  }
  // OAuth (code) sign-ins without an explicit next land on /account;
  // email-link flows (token_hash) keep /reset-password as their default.
  const fallback = code ? "/account" : "/reset-password";
  if (!searchParams.get("next")) rawNext = fallback;
  const next = /^\/[^/\\]/.test(rawNext) ? rawNext : fallback;

  try {
    const supabase = createClient();
    if (code) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        if (data.user?.id) await enforceSingleSession(data.user.id);
        return NextResponse.redirect(`${origin}${next}`);
      }
    } else if (
      tokenHash &&
      (type === "recovery" || type === "signup" || type === "invite" || type === "magiclink")
    ) {
      const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
      if (!error) {
        if (data.user?.id) await enforceSingleSession(data.user.id);
        return NextResponse.redirect(`${origin}${next}`);
      }
    }
  } catch {
    // Unconfigured Supabase or network hiccup - fall through to the failure redirect.
  }
  return NextResponse.redirect(`${origin}/login?error=link`);
}
