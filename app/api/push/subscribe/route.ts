import { NextResponse } from "next/server";
import { createClient, getSessionUser } from "../../../../lib/supabase/server";

type SubscriptionBody = { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };

// Persist (or refresh) this browser's Web Push subscription (W-3).
// RLS-gated: users write only their own rows — no service role here.
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user)
    return NextResponse.json({ error: "Sign in to turn on notifications." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const subscription = (body?.subscription ?? null) as SubscriptionBody | null;
  const endpoint = typeof subscription?.endpoint === "string" ? subscription.endpoint : "";
  const p256dh = typeof subscription?.keys?.p256dh === "string" ? subscription.keys.p256dh : "";
  const auth = typeof subscription?.keys?.auth === "string" ? subscription.keys.auth : "";
  if (!endpoint.startsWith("https://") || !p256dh || !auth) {
    return NextResponse.json({ error: "Invalid push subscription." }, { status: 400 });
  }

  const userAgent = request.headers.get("user-agent")?.slice(0, 300) ?? "";
  const { error } = await createClient().from("web_push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint,
      p256dh,
      auth,
      user_agent: userAgent,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,endpoint" }
  );
  if (error)
    return NextResponse.json(
      { error: "Could not save your notification settings." },
      { status: 500 }
    );
  return NextResponse.json({ ok: true });
}
