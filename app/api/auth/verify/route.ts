import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  createServiceClient,
  createClient,
  supabaseConfigured,
} from "../../../../lib/supabase/server";
import { resolveSignInRole } from "../../../../lib/auth-role";
import { checkRateLimit, clientIp } from "../../../../lib/rate-limit";
import { enforceSingleSession } from "../../../../lib/single-session";

// Verifies an emailed one-time code and starts the session.
//
// Two purposes share this endpoint:
//   signup - proves the address a registration was made with ("confirm your
//            email"), required for a first registration
//   signin - proves the address after suspicious sign-in attempts (see
//            app/api/auth/login/route.ts)
//
// The registration email carries the code only once a custom SMTP provider is
// configured: Supabase Free with the default sender refuses template edits, so
// the default email stays link-only. The panel therefore offers "code or link"
// and this endpoint accepts the code as soon as the template has one.
function jsonWithCookies(body: unknown, init?: Parameters<typeof NextResponse.json>[1]) {
  const res = NextResponse.json(body, init);
  try {
    for (const c of cookies().getAll()) res.cookies.set(c);
  } catch {}
  return res;
}

export async function POST(request: Request) {
  if (!supabaseConfigured())
    return jsonWithCookies({ error: "Accounts are not configured." }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const email = String(body.email || "")
    .trim()
    .toLowerCase();
  const token = String(body.token || "").replace(/\s+/g, "");
  const purpose = body.purpose === "signin" ? "signin" : "signup";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^\d{6,10}$/.test(token)) {
    return jsonWithCookies({ error: "Enter the code from your email." }, { status: 400 });
  }

  // A code is short by design, so guessing has to be throttled per address.
  const limit = checkRateLimit(`verify:${clientIp(request)}:${email}`, 10, 60_000);
  if (!limit.allowed) {
    return jsonWithCookies(
      { error: "Too many code attempts. Please wait a minute and try again." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  try {
    const supabase = createClient();
    const { data, error } = await supabase.auth.verifyOtp(
      purpose === "signin" ? { type: "email", email, token } : { type: "signup", email, token }
    );
    if (error || !data.user) {
      return jsonWithCookies(
        { error: "That code is invalid or has expired. Send a new one." },
        { status: 400 }
      );
    }

    const role = await resolveSignInRole(supabase, data.user);
    await enforceSingleSession(data.user.id);

    // A verified code settles any suspicion recorded for this address.
    try {
      await createServiceClient().from("auth_failures").delete().eq("email", email);
    } catch {
      // Counter cleanup is best-effort; the window expires on its own.
    }

    return jsonWithCookies({ ok: true, role });
  } catch {
    return jsonWithCookies(
      { error: "Accounts are temporarily unavailable. Try again." },
      { status: 503 }
    );
  }
}
