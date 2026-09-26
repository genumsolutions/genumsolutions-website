import { NextResponse } from "next/server";
import { isStaffRequest } from "../../../../lib/admin";
import { createServiceClient } from "../../../../lib/supabase/server";
import {
  dedupeSuggestions,
  suggestComponents,
  type CatalogCandidate,
} from "../../../../lib/project-components";

export const dynamic = "force-dynamic";

/**
 * U-45 (2026-09-26) — admin linker for project ↔ component links.
 *
 * GET  ?projectId=…  → { components: {productId, quantity}[], suggestions: [...] }
 *   Suggestions come from lib/project-components.ts over the LIVE Electronic
 *   Products catalog (applyScope "components"); aliases arrive as an env-free
 *   empty map for now (the admin UI can extend them later).
 * PUT  { projectId, components: [{productId, quantity}] } → replaces ALL links
 *   for the project (simple + predictable — the editor always sends the full
 *   list). staff+ gated like every other admin write; the service client
 *   performs the write (public RLS is read-only).
 */

type ComponentLink = { productId: string; quantity: number };

export async function GET(request: Request) {
  if (!(await isStaffRequest()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const projectId = new URL(request.url).searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ error: "projectId is required." }, { status: 400 });

  const client = createServiceClient();
  const { data: links, error: linksError } = await client
    .from("project_components")
    .select("product_id, quantity, sort_order")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true });
  if (linksError) return NextResponse.json({ error: linksError.message }, { status: 500 });

  // Suggestions: match the project's materials_required against the live
  // components catalog. Cheap enough to compute per-open (5 projects × small
  // catalog) and always in sync with the current catalog.
  const [{ data: project }, { data: products }] = await Promise.all([
    client.from("products").select("materials_required").eq("id", projectId).maybeSingle(),
    client.from("products").select("id, name, sku, category, product_type").eq("active", true),
  ]);
  const materials = Array.isArray(project?.materials_required)
    ? (project!.materials_required as unknown[]).filter((m): m is string => typeof m === "string")
    : [];
  // Match over the RAW rows (the linker only needs id/name/sku). The
  // components-scope predicate is inlined (same contract as applyScope's
  // "components" branch) without mapping full Product objects — keeps the
  // endpoint cheap and the types honest.
  const isComponentRow = (p: {
    category?: string | null;
    product_type?: string | null;
  }): boolean => {
    const cat = (p.category ?? "").trim().toLowerCase();
    if (cat === "robot cars".toLowerCase()) return false;
    if (cat === "pre-packaged kits".toLowerCase()) return false;
    if (cat === "3d models") return false;
    return (p.product_type ?? "Retail kit") !== "Project package";
  };
  const catalog: CatalogCandidate[] = (products ?? [])
    .filter(isComponentRow)
    .map((p: { id: unknown; name: unknown; sku: unknown }) => ({
      id: String(p.id),
      name: String(p.name),
      sku: String(p.sku ?? ""),
    }));
  const suggestions = dedupeSuggestions(suggestComponents(materials, catalog));

  return NextResponse.json({
    components: ((links ?? []) as { product_id: string; quantity: number }[]).map((l) => ({
      productId: l.product_id,
      quantity: l.quantity,
    })),
    suggestions,
  });
}

export async function PUT(request: Request) {
  if (!(await isStaffRequest()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const projectId = typeof body?.projectId === "string" ? body.projectId.trim() : "";
  const incoming = Array.isArray(body?.components) ? body.components : null;
  if (!projectId || !incoming)
    return NextResponse.json(
      { error: "projectId and components[] are required." },
      { status: 400 }
    );

  // Validate + clamp; drop nulls/dupes so the write is deterministic.
  const seen = new Set<string>();
  const rows: ComponentLink[] = [];
  for (const entry of incoming) {
    const productId = typeof entry?.productId === "string" ? entry.productId.trim() : "";
    const quantity = Math.max(1, Math.min(99, Math.round(Number(entry?.quantity) || 1)));
    if (!productId || seen.has(productId)) continue;
    seen.add(productId);
    rows.push({ productId, quantity });
  }

  const client = createServiceClient();
  const { data: project } = await client
    .from("products")
    .select("id")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
  if (rows.length) {
    const { data: valid } = await client
      .from("products")
      .select("id")
      .in(
        "id",
        rows.map((r) => r.productId)
      );
    const validIds = new Set(((valid ?? []) as { id: string }[]).map((v) => v.id));
    for (let i = rows.length - 1; i >= 0; i -= 1) {
      if (!validIds.has(rows[i]!.productId)) rows.splice(i, 1);
    }
  }

  const { error } = await client.from("project_components").delete().eq("project_id", projectId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (rows.length) {
    const { error: insertError } = await client.from("project_components").upsert(
      rows.map((r, i) => ({
        project_id: projectId,
        product_id: r.productId,
        quantity: r.quantity,
        sort_order: (i + 1) * 10,
      }))
    );
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, saved: rows.length });
}
