import { NextResponse } from "next/server";
import { createServiceClient } from "../../../lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * U-45 (2026-09-26) — PUBLIC reverse lookup for the detail page's
 * "Used in these projects" strip: given a component product id, return the
 * ACTIVE project packages that link to it. Read-only, no auth (the join
 * table's RLS is public-read anyway); only project ids are exposed — the
 * client maps them against the already-public catalog.
 */
export async function GET(request: Request) {
  const productId = new URL(request.url).searchParams.get("productId");
  if (!productId) return NextResponse.json({ error: "productId is required." }, { status: 400 });

  const client = createServiceClient();
  const { data, error } = await client
    .from("project_components")
    .select("project_id, products!project_components_project_id_fkey(product_type, active)")
    .eq("product_id", productId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  type UsageRow = {
    project_id: string;
    products: { product_type: string; active: boolean }[] | null;
  };
  const projects = ((data ?? []) as unknown as UsageRow[])
    .filter(
      (row) =>
        // The embedded products row is 0-or-1 (a join to a single product);
        // Supabase types the array shape, the runtime value is first-element.
        row.products?.[0]?.product_type === "Project package" && row.products?.[0]?.active !== false
    )
    .map((row) => ({ projectId: row.project_id }));

  return NextResponse.json({ projects });
}
