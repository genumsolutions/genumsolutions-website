import { NextResponse } from "next/server";
import { createServiceClient, getSessionUser } from "../../../lib/supabase/server";
import { listCollection, toggleCollection } from "../../../lib/collection";

export const dynamic = "force-dynamic";

type CollectionRow = {
  itemId: string;
  itemKind: string;
  createdAt: string;
};

/** Map a products/services row onto the minimal collection-card shape. */
type CollectionCard = {
  itemId: string;
  itemKind: "product" | "service";
  name: string;
  priceLabel: string;
  image: string;
  href: string;
  savedAt: string;
};

/**
 * U-47 (2026-09-27) — the signed-in user's collection (hearts).
 * GET  → { items: [{ itemId, itemKind }], signedIn }
 * POST { itemId, kind? } → toggle; { saved, signedIn }
 * RLS scopes every row to the caller; guests get signedIn: false and the
 * UI treats the heart as a sign-in prompt (never an error).
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ items: [], signedIn: false });
  try {
    const rows: CollectionRow[] = await listCollection();
    if (rows.length === 0) return NextResponse.json({ items: [], signedIn: true });
    // Hydrate: resolve ids against the shared catalog tables with the
    // service client (rows are the user's own; the referenced rows are
    // public anyway — this just saves a client round-trip).
    const productIds = rows.filter((r) => r.itemKind === "product").map((r) => r.itemId);
    const serviceIds = rows.filter((r) => r.itemKind === "service").map((r) => r.itemId);
    const client = createServiceClient();
    const cards: CollectionCard[] = [];
    if (productIds.length) {
      const { data } = await client
        .from("products")
        .select("id, name, price_label, image_url, gallery, active")
        .in("id", productIds);
      for (const row of (data ?? []) as Record<string, unknown>[]) {
        const savedAt = rows.find((r) => r.itemId === String(row.id))?.createdAt ?? "";
        cards.push({
          itemId: String(row.id),
          itemKind: "product",
          name: String(row.name ?? row.id),
          priceLabel: String(row.price_label ?? ""),
          image:
            (Array.isArray(row.gallery) && String(row.gallery[0] ?? "")) ||
            String(row.image_url ?? ""),
          href: `/products/${String(row.id)}`,
          savedAt,
        });
      }
    }
    if (serviceIds.length) {
      const { data } = await client
        .from("services")
        .select("id, name, price_label, active")
        .in("id", serviceIds);
      for (const row of (data ?? []) as Record<string, unknown>[]) {
        const savedAt = rows.find((r) => r.itemId === String(row.id))?.createdAt ?? "";
        cards.push({
          itemId: String(row.id),
          itemKind: "service",
          name: String(row.name ?? row.id),
          priceLabel: String(row.price_label ?? ""),
          image: "",
          href: "/services",
          savedAt,
        });
      }
    }
    // Keep the user's saved order (newest first).
    cards.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
    return NextResponse.json({ items: cards, signedIn: true });
  } catch {
    return NextResponse.json({ items: [], signedIn: true });
  }
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user)
    return NextResponse.json(
      { error: "Sign in to save items to your collection.", signedIn: false },
      { status: 401 }
    );
  const body = await request.json().catch(() => null);
  const itemId = typeof body?.itemId === "string" ? body.itemId.trim() : "";
  const kind = body?.kind === "service" ? "service" : "product";
  if (!itemId) return NextResponse.json({ error: "itemId is required." }, { status: 400 });
  try {
    const saved = await toggleCollection(itemId, kind);
    return NextResponse.json({ saved, signedIn: true });
  } catch {
    return NextResponse.json({ error: "Could not update the collection." }, { status: 500 });
  }
}
