import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
import { checkRateLimit, clientIp } from "../../../../lib/rate-limit";

// Re-sends the registration confirmation email. Always answers ok so the
// response never reveals whether an account exists for the given address.
export async function POST(request: Request) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL)
    return NextResponse.json({ error: "Accounts are not configured." }, { status: 503 });

  // Supabase caps confirmation mail per hour, so never let one visitor spend it.
  const limit = checkRateLimit(`resend:${clientIp(request)}`, 3, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many resend attempts. Please wait a minute and try again." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  const body = await request.json().catch(() => ({}));
  const email = String(body.email || "")
    .trim()
    .toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });

  const origin = new URL(request.url).origin;
  try {
    await createClient().auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/account?welcome=1")}`,
      },
    });
  } catch {
    // Swallow provider errors - the generic ok below covers them.
  }
  return NextResponse.json({ ok: true });
}
