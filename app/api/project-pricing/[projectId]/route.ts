import { NextResponse } from "next/server";
import { getPublishedProjectPricing } from "../../../../lib/project-pricing-store";

export const dynamic = "force-dynamic";

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
            priceApprovedAt: pricing.priceApprovedAt,
            priceApprovedBy: pricing.priceApprovedBy,
            note: pricing.note,
          }
        : null,
    });
  } catch (error) {
    console.error("Project pricing read failed", error);
    return NextResponse.json({ error: "Could not load the project pricing." }, { status: 500 });
  }
}
