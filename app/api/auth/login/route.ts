import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  createClient,
  createServiceClient,
  supabaseConfigured,
} from "../../../../lib/supabase/server";
import { resolveSignInRole } from "../../../../lib/auth-role";
import { checkRateLimit, clientIp } from "../../../../lib/rate-limit";
import { enforceSingleSession } from "../../../../lib/single-session";

// Attempts inside this window make an address "suspicious": from then on a
// password alone is not enough and the visitor has to prove the mailbox.
const SUSPICIOUS_WINDOW_MS = 15 * 60_000;
const SUSPICIOUS_ATTEMPTS = 3;

/** Service-role client for the failure counter, or null when unavailable. */
function counter() {
  try {
    return createServiceClient();
  } catch {
    return null;
  }
}

// Canonical email + password sign-in. Returns the caller's role so the UI
// can route admins to /admin and customers to /account.
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
  const password = String(body.password || "");
  if (!email || !password)
    return jsonWithCookies({ error: "Email and password are required." }, { status: 400 });

  // Throttle per IP and per account to slow credential stuffing.
  for (const key of [`login-ip:${clientIp(request)}`, `login-acct:${email}`]) {
    const limit = checkRateLimit(key, 10, 60_000);
    if (!limit.allowed) {
      return jsonWithCookies(
        { error: "Too many sign-in attempts. Please wait a minute and try again." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
      );
    }
  }

  try {
    const supabase = createClient();
    const db = counter();

    // Suspicion is counted in the database, not in memory: serverless instances
    // do not share state, so an in-memory counter would forget an attacker as
    // soon as the next instance served the request.
    let failures = 0;
    if (db) {
      try {
        const { count } = await db
          .from("auth_failures")
          .select("*", { count: "exact", head: true })
          .eq("email", email)
          .gte("created_at", new Date(Date.now() - SUSPICIOUS_WINDOW_MS).toISOString());
        failures = count ?? 0;
      } catch {
        failures = 0;
      }
    }

    if (failures >= SUSPICIOUS_ATTEMPTS) {
      // Refuse the password entirely for a suspicious address and send a
      // one-time email instead. shouldCreateUser:false keeps this from becoming
      // an account-existence oracle.
      const sendLimit = checkRateLimit(`login-code:${email}`, 1, 120_000);
      if (sendLimit.allowed) {
        await supabase.auth.signInWithOtp({
          email,
          options: { shouldCreateUser: false, emailRedirectTo: undefined },
        });
      }
      return jsonWithCookies({
        requiresVerification: true,
        email,
        message: "Too many failed attempts. Enter the code we emailed you to continue.",
      });
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      const msg = error?.message || "";
      // "Email not confirmed" is not a wrong password - never count it as a
      // failed attempt (that would lock the account behind the suspicion flow)
      // and tell the user exactly what to do.
      if (/email not confirmed/i.test(msg)) {
        return jsonWithCookies(
          {
            error:
              "Please confirm your email before signing in. Check your inbox for the confirmation link.",
            needsEmailConfirmation: true,
            email,
          },
          { status: 403 }
        );
      }
      const invalidCredentials = /invalid login credentials/i.test(msg);
      if (db && (invalidCredentials || !msg)) {
        try {
          await db.from("auth_failures").insert({ email, ip: clientIp(request) });
          // Opportunistic pruning keeps a free-tier table from growing forever.
          if (Math.random() < 0.05) {
            await db
              .from("auth_failures")
              .delete()
              .lt("created_at", new Date(Date.now() - 24 * 60 * 60_000).toISOString());
          }
        } catch {
          // Counting is best-effort; the throttle above still applies.
        }
      }
      return jsonWithCookies(
        { error: invalidCredentials || !msg ? "Invalid email or password." : msg },
        { status: 401 }
      );
    }

    // Start the single-session cleanup now so it overlaps the profile lookup:
    // the request waits for the slower of the two, not for both in series.
    // (Vercel may freeze unawaited work after the response, so it still runs
    // inside the request.)
    const singleSession = enforceSingleSession(data.user.id);
    const role = await resolveSignInRole(supabase, data.user);
    if (db) {
      // Cleanup is best-effort and never worth blocking the redirect on.
      void db
        .from("auth_failures")
        .delete()
        .eq("email", email)
        .then(
          () => {},
          () => {}
        );
    }
    void singleSession.catch(() => {});

    return jsonWithCookies({ ok: true, role });
  } catch {
    return jsonWithCookies(
      { error: "Accounts are temporarily unavailable. Try again." },
      { status: 503 }
    );
  }
}
