// =====================================================================
// collection.ts — U-47 (2026-09-27): per-user saved cards.
//
// The `user_collection` table (RLS: own rows only) backs the heart on
// every card and the "My collection" section on /account. item_kind
// distinguishes products (incl. project packages) from services. Reads
// use the anon (cookie) client so RLS scopes rows to the signed-in
// user; every helper returns an empty/failed state when signed out.
// =====================================================================
import { createClient, getSessionUser, supabaseConfigured } from "./supabase/server";

export type CollectionItemKind = "product" | "service";

export type CollectionItem = {
  itemId: string;
  itemKind: CollectionItemKind;
  createdAt: string;
};

/** All collection rows for the signed-in user (newest first). */
export async function listCollection(): Promise<CollectionItem[]> {
  if (!supabaseConfigured()) return [];
  const user = await getSessionUser();
  if (!user) return [];
  const { data, error } = await createClient()
    .from("user_collection")
    .select("item_id, item_kind, created_at")
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data ?? []).map((row) => ({
    itemId: String(row.item_id ?? ""),
    itemKind: row.item_kind === "service" ? "service" : "product",
    createdAt: String(row.created_at ?? ""),
  }));
}

/** Ids only (products + services mixed) — for heart-state hydration. */
export async function listCollectionIds(): Promise<Set<string>> {
  const rows = await listCollection();
  return new Set(rows.map((r) => r.itemId));
}

/** Toggle; returns the new state. False when signed out. */
export async function toggleCollection(
  itemId: string,
  kind: CollectionItemKind = "product"
): Promise<boolean> {
  if (!supabaseConfigured()) return false;
  const user = await getSessionUser();
  if (!user) return false;
  const client = createClient();
  const { data: existing } = await client
    .from("user_collection")
    .select("item_id")
    .eq("item_id", itemId)
    .eq("item_kind", kind)
    .limit(1);
  if ((existing ?? []).length > 0) {
    const { error } = await client
      .from("user_collection")
      .delete()
      .eq("item_id", itemId)
      .eq("item_kind", kind);
    return !error ? false : true;
  }
  const { error } = await client
    .from("user_collection")
    .insert({ item_id: itemId, item_kind: kind });
  return !error;
}
