import { NextResponse } from "next/server";
import {
  createClient,
  createServiceClient,
  supabaseConfigured,
} from "../../../../lib/supabase/server";
import { checkRateLimit, clientIp } from "../../../../lib/rate-limit";

// The native app signs in directly against Supabase (no website cookies), so it
// cannot rely on /api/auth/login for the "suspicious sign-in needs a code"
// gate. This endpoint shares the same counter and threshold so the rule is
// identical on both surfaces.
//
// action: "check"  -> is this address currently suspicious? if so, send a code.
// action: "fail"   -> record one failed password attempt.
// action: "clear"  -> drop the counter after a successful sign-in.

const WINDOW_MS = 15 * 60_000;
const THRESHOLD = 3;

export async function POST(request: Request) {
  if (!supabaseConfigured())
    return NextResponse.json({ error: "Accounts are not configured." }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const email = String(body.email || "")
    .trim()
    .toLowerCase();
  const action = String(body.action || "check");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return NextResponse.json({ error: "Email is required." }, { status: 400 });

  let db;
  try {
    db = createServiceClient();
  } catch {
    return NextResponse.json({ requiresVerification: false });
  }

  if (action === "clear") {
    try {
      await db.from("auth_failures").delete().eq("email", email);
    } catch {}
    return NextResponse.json({ ok: true });
  }

  if (action === "fail") {
    try {
      await db.from("auth_failures").insert({ email, ip: clientIp(request) });
    } catch {}
    return NextResponse.json({ ok: true });
  }

  // "check": refuse the password for a suspicious address and email a code.
  const limit = checkRateLimit(`suspicion:${clientIp(request)}:${email}`, 20, 60_000);
  if (!limit.allowed) return NextResponse.json({ requiresVerification: false });

  let failures = 0;
  try {
    const { count } = await db
      .from("auth_failures")
      .select("*", { count: "exact", head: true })
      .eq("email", email)
      .gte("created_at", new Date(Date.now() - WINDOW_MS).toISOString());
    failures = count ?? 0;
  } catch {
    failures = 0;
  }

  if (failures < THRESHOLD) return NextResponse.json({ requiresVerification: false });

  const sendLimit = checkRateLimit(`login-code:${email}`, 1, 120_000);
  if (sendLimit.allowed) {
    try {
      await createClient().auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false, emailRedirectTo: undefined },
      });
    } catch {}
  }
  return NextResponse.json({
    requiresVerification: true,
    email,
    message: "Too many failed attempts. Enter the code we emailed you to continue.",
  });
}
