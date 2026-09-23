import { NextResponse } from "next/server";
import { checkRateLimit, clientIp } from "../../../lib/rate-limit";
import { isValidEmail, subscribeToNewsletter } from "../../../lib/newsletter";

export const runtime = "nodejs";

// C4 (2026-09-23): public newsletter opt-in. Anonymous POST { email, source? }
// -> idempotent upsert into newsletter_subscribers. 20/min/IP (generous: the
// same email re-submitted is a no-op, not an error).
export async function POST(request: Request) {
  const limit = checkRateLimit(`newsletter:${clientIp(request)}`, 20, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Please wait a minute and try again." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  try {
    const body = (await request.json().catch(() => null)) as {
      email?: unknown;
      source?: unknown;
    } | null;
    const email = typeof body?.email === "string" ? body.email.trim() : "";
    const source = body?.source === "checkout" ? "checkout" : "footer";

    if (!email) {
      return NextResponse.json({ error: "Please enter your email address." }, { status: 400 });
    }
    if (!isValidEmail(email)) {
      return NextResponse.json({ error: "Please check your email address." }, { status: 400 });
    }

    await subscribeToNewsletter(email, source);
    return NextResponse.json({
      message: "You are on the list. Watch your inbox for new kits and projects.",
    });
  } catch (error) {
    console.error("Newsletter subscribe failed", error);
    return NextResponse.json(
      { error: "Could not subscribe right now. Please try again later." },
      { status: 500 }
    );
  }
}
