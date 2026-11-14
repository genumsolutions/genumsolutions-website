import { NextResponse } from "next/server";
import { getPublishedProjectPricing } from "../../../../lib/project-pricing-store";

export const dynamic = "force-dynamic";
// 2026-11-14: `smart-dustbin` kept answering `pricing: null` long after its row
// was approved, while its ten siblings were live. The row and the code were
// both correct (a local `next dev` against the same database returned it), so
// a build-time fetch was serving the stale value for that one URL. Opting the
// route's fetches out of the data cache is the documented fix.
export const fetchCache = "force-no-store";

/** Public project pricing row for one project package.
 *
 * Only returns the row when an admin has approved it; otherwise returns null
 * (the storefront shows "rate on request"). The customer-facing estimate is
 * computed client-side by the detail page from this row + the component links
 * (from /api/admin/project-components) + the catalog prices.
 *
 * Mirrors the shape of /api/print (public 3D print content) for parity.
 */

export async function GET(_request: Request, { params }: { params: { projectId: string } }) {
  const projectId = (params.projectId ?? "").trim();
  if (!projectId) return NextResponse.json({ error: "projectId is required." }, { status: 400 });

  try {
    const pricing = await getPublishedProjectPricing(projectId);
    return NextResponse.json({
      projectId,
      pricing: pricing
        ? {
            id: pricing.id,
            packageBaseCharge: pricing.packageBaseCharge,
            componentMarkupPercent: pricing.componentMarkupPercent,
            extras: pricing.extras,
            bulkTiers: pricing.bulkTiers,
            minimumOrder: pricing.minimumOrder,
            priceStatus: pricing.priceStatus,
            // Deliberately NOT exposed: `note` is an internal pricing note and
            // `priceApprovedBy` is a staff email — neither belongs in a
            // public payload.
          }
        : null,
    });
  } catch (error) {
    console.error("Project pricing read failed", error);
    return NextResponse.json({ error: "Could not load the project pricing." }, { status: 500 });
  }
}
