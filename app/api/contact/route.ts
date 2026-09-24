import { NextResponse } from "next/server";
import { sendEmail } from "../../../lib/email";
import { getSessionUser } from "../../../lib/supabase/server";
import { addCustomerMessage } from "../../../lib/customer-store";
import { checkRateLimit, clientIp } from "../../../lib/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const limit = checkRateLimit(`contact:${clientIp(request)}`, 5, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many inquiries sent. Please wait a minute and try again." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }
  try {
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const message = typeof body.message === "string" ? body.message.trim() : "";

    if (!name || !email || !message)
      return NextResponse.json({ error: "Please complete all fields." }, { status: 400 });
    if (
      name.length > 100 ||
      email.length > 254 ||
      message.length > 5000 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return NextResponse.json(
        { error: "Please check your details and try again." },
        { status: 400 }
      );
    }

    const user = await getSessionUser();
    // R6 parity fix: persist EVERY inquiry (guests included — the app's edge
    // function already does this and RLS allows anon inserts). Previously a
    // guest message lived only in the email send, so a missing/broken
    // RESEND_API_KEY (500) destroyed it before anyone saw it.
    let persisted = false;
    try {
      await addCustomerMessage(user?.id ?? null, { name, email, message });
      persisted = true;
    } catch (error) {
      console.error("Message persistence failed", error);
    }
    try {
      await sendEmail({
        replyTo: email,
        subject: `New website inquiry from ${name}`,
        text: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`,
      });
      return NextResponse.json({ message: "Thanks. Your inquiry has been sent.", persisted });
    } catch (error) {
      // Email is best-effort: the message is safely in the admin inbox, so
      // don't tell the customer the submission failed.
      console.error("Contact email failed (message persisted)", error);
      return NextResponse.json({
        message: "Thanks. Your inquiry has been received — our team will get back to you shortly.",
        persisted,
      });
    }
  } catch (error) {
    console.error("Contact email failed", error);
    return NextResponse.json(
      { error: "We could not send your inquiry right now. Please email us directly." },
      { status: 500 }
    );
  }
}
