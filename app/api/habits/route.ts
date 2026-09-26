import { NextResponse } from "next/server";
import { createClient, getSessionUser } from "../../../lib/supabase/server";

export const dynamic = "force-dynamic";

const KINDS = new Set(["view", "search", "cart", "order"]);

/**
 * U-47v2 — per-user habit tracking. POST { kind: "view"|"search"|"cart"|"order" }
 * Increments the signed-in user's aggregated counters via the track_habit
 * SECURITY DEFINER RPC (guests are ignored server-side; 204 keeps the
 * client's fire-and-forget quiet).
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const kind = typeof body?.kind === "string" ? body.kind : "";
  if (!KINDS.has(kind))
    return NextResponse.json({ error: "kind must be view|search|cart|order" }, { status: 400 });

  const user = await getSessionUser();
  if (!user) return new NextResponse(null, { status: 204 });

  const { error } = await createClient().rpc("track_habit", { p_kind: kind });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export type UserHabits = {
  viewed_count: number;
  search_count: number;
  cart_adds: number;
  orders_placed: number;
  last_viewed_at: string | null;
  last_search_at: string | null;
  last_cart_at: string | null;
  last_order_at: string | null;
};

/**
 * U-47v4 — read the signed-in user's habit counters for the
 * "Your activity" block on /account (and the app's Account screen).
 * Guests get 204; the block simply never renders signed-out.
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return new NextResponse(null, { status: 204 });

  const { data, error } = await createClient()
    .from("user_habits")
    .select(
      "viewed_count, search_count, cart_adds, orders_placed, last_viewed_at, last_search_at, last_cart_at, last_order_at"
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    habits: data ?? {
      viewed_count: 0,
      search_count: 0,
      cart_adds: 0,
      orders_placed: 0,
      last_viewed_at: null,
      last_search_at: null,
      last_cart_at: null,
      last_order_at: null,
    },
  });
}
