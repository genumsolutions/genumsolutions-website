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
