import { NextResponse } from "next/server";
import { createClient, supabaseConfigured } from "../../../../lib/supabase/server";
import { checkRateLimit, clientIp } from "../../../../lib/rate-limit";
import { enforceSingleSession } from "../../../../lib/single-session";

// Creates a customer account with email + password (works for Gmail or any address).
export async function POST(request: Request) {
  if (!supabaseConfigured())
    return NextResponse.json({ error: "Accounts are not configured." }, { status: 503 });

  const limit = checkRateLimit(`register:${clientIp(request)}`, 5, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many registration attempts. Please wait a minute and try again." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  const body = await request.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  const email = String(body.email || "")
    .trim()
    .toLowerCase();
  const password = String(body.password || "");

  if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 6) {
    return NextResponse.json(
      { error: "Enter a name, valid email, and password of at least 6 characters." },
      { status: 400 }
    );
  }

  // Registration is the one flow that must prove the address is real, so the
  // confirmation link returns to this host's callback (localhost rounds-trip
  // locally) and lands on the account page once the address is verified.
  const origin = new URL(request.url).origin;
  try {
    const { data, error } = await createClient().auth.signUp({
      email,
      password,
      options: {
        data: { name },
        emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/account?welcome=1")}`,
      },
    });

    if (error) {
      const exists = /already registered|already exists/i.test(error.message);
      return NextResponse.json(
        {
          error: exists
            ? "That email is already registered. Sign in instead."
            : "Could not register. Try again.",
        },
        { status: exists ? 409 : 500 }
      );
    }
    // With email confirmation on (the project default for a real store), signUp
    // returns no session: the UI shows the "check your email" notice and offers
    // a resend instead of pretending the user is signed in.
    if (!data.session) return NextResponse.json({ ok: true, needsEmailConfirmation: true });
    if (data.user?.id) await enforceSingleSession(data.user.id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Accounts are temporarily unavailable. Try again." },
      { status: 503 }
    );
  }
}
