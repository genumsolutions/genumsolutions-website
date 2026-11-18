import { NextResponse } from "next/server";
import { isStaffRequest } from "../../../../lib/admin";
import { createServiceClient } from "../../../../lib/supabase/server";
import { projectDetailColumnsAvailable } from "../../../../lib/content-store";
import { projectDetailDrift } from "../../../../lib/project-details";

// =====================================================================
// GET /api/admin/project-detail-drift
//
// Data-integrity check for the 2026-11-18 project-detail columns rollout.
// Both copies are written during the rollout; an older app bundle (or an OTA
// build in the field) writes only `import_meta.projectDetails`, and the reader
// prefers the column, so that stale JSON copy is invisible. This lists every
// package where the two disagree, so the drift is visible before the JSON copy
// is finally dropped.
//
// Pre-migration this returns `columnsAvailable: false` and no rows: an empty
// column is "never migrated", not drift.
// =====================================================================

export async function GET() {
  if (!(await isStaffRequest()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const columnsAvailable = await projectDetailColumnsAvailable();
    if (!columnsAvailable) {
      return NextResponse.json({
        columnsAvailable: false,
        packages: 0,
        count: 0,
        products: [],
      });
    }

    const { data, error } = await createServiceClient()
      .from("products")
      .select("*")
      .eq("product_type", "Project package")
      .order("name", { ascending: true });
    if (error) throw error;

    const products = (data ?? [])
      .map((row: Record<string, unknown>) => ({
        id: String(row.id ?? ""),
        name: String(row.name ?? ""),
        drift: projectDetailDrift((row.import_meta ?? null) as Record<string, unknown> | null, row),
      }))
      .filter((product) => product.drift.length > 0);

    return NextResponse.json({
      columnsAvailable: true,
      packages: (data ?? []).length,
      count: products.length,
      products,
    });
  } catch (error) {
    console.error("Project detail drift check failed", error);
    return NextResponse.json({ error: "Could not check project details." }, { status: 500 });
  }
}
