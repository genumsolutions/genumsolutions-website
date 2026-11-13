import { NextResponse } from "next/server";
import { isAdminRequest, isStaffRequest } from "../../../../lib/admin";
import { logActivity } from "../../../../lib/activity";
import {
  getProjectPricing,
  listProjectPricing,
  saveProjectPricing,
  setProjectPricingApproval,
} from "../../../../lib/project-pricing-store";
import {
  type ProjectPricing,
  type ProjectPricingExtra,
  type ProjectPricingBulkTier,
} from "../../../../lib/project-pricing";
import { revalidateProjectPricing } from "../../../../lib/revalidate";
import { getSessionUser } from "../../../../lib/supabase/server";

export const runtime = "nodejs";

const text = (value: unknown, max = 500): string =>
  typeof value === "string" ? value.trim().slice(0, max) : "";
const number = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

/** Parse + clamp a pricing row from the request body. */
function parsePricing(body: Record<string, unknown>, projectId: string): ProjectPricing {
  const bulkTiers: ProjectPricingBulkTier[] = Array.isArray(body.bulkTiers)
    ? body.bulkTiers
        .map((tier): ProjectPricingBulkTier | null => {
          if (typeof tier !== "object" || tier === null) return null;
          return {
            minQty: Math.max(1, Math.round(number((tier as Record<string, unknown>).minQty, 1))),
            discountPercent: Math.min(
              90,
              Math.max(0, number((tier as Record<string, unknown>).discountPercent, 0))
            ),
          };
        })
        .filter((t): t is ProjectPricingBulkTier => t !== null && t.minQty > 0)
        .slice(0, 10)
    : [];

  const extras: ProjectPricingExtra[] = Array.isArray(body.extras)
    ? body.extras
        .map((extra): ProjectPricingExtra | null => {
          if (typeof extra !== "object" || extra === null) return null;
          const e = extra as Record<string, unknown>;
          const rawId = e.id != null ? String(e.id) : "";
          const rawName = e.name != null ? String(e.name) : "";
          return {
            id: text(rawId || rawName, 60),
            name: text(rawName, 60),
            amount: Math.max(0, Math.round(number(e.amount, 0))),
          };
        })
        .filter((e): e is ProjectPricingExtra => e !== null && Boolean(e.id && e.name))
        .slice(0, 20)
    : [];

  return {
    id: projectId,
    packageBaseCharge: Math.max(0, Math.round(number(body.packageBaseCharge))),
    componentMarkupPercent: Math.max(
      0,
      Math.min(500, Math.round(number(body.componentMarkupPercent)))
    ),
    extras,
    bulkTiers,
    minimumOrder: Math.max(0, Math.round(number(body.minimumOrder))),
    priceStatus: body.priceStatus === "approved" ? ("approved" as const) : ("draft" as const),
    priceApprovedAt: typeof body.priceApprovedAt === "string" ? body.priceApprovedAt : null,
    priceApprovedBy: text(body.priceApprovedBy, 120),
    note: text(body.note, 300),
    updatedAt: new Date().toISOString(),
  };
}

export async function GET(request: Request) {
  if (!(await isStaffRequest()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const search = new URL(request.url).searchParams;
    const projectId = search.get("projectId") ?? "";
    if (!projectId) {
      const all = await listProjectPricing();
      return NextResponse.json({ pricing: all });
    }
    const pricing = await getProjectPricing(projectId);
    return NextResponse.json({ pricing });
  } catch (error) {
    console.error("Admin project-pricing read failed", error);
    return NextResponse.json({ error: "Could not read the pricing." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  if (!(await isStaffRequest()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json().catch(() => ({}));
    const projectId = text(body.projectId, 80);
    if (!projectId) return NextResponse.json({ error: "projectId is required." }, { status: 400 });

    const resource = text(body.resource, 30);
    if (resource === "pricing") {
      // Approve / withdraw — admin only (mirrors the print "pricing" action).
      if (!(await isAdminRequest()))
        return NextResponse.json(
          { error: "Only administrators can approve or withdraw project pricing." },
          { status: 403 }
        );
      const approved: boolean = body.approved === true;
      const user = await getSessionUser();
      const approvedBy = approved ? text(user?.email ?? "admin", 120) || "admin" : "";
      await setProjectPricingApproval({ projectId, approved, approvedBy });
      await logActivity({
        action: approved ? "project.pricing.approved" : "project.pricing.withdrawn",
        entityType: "project_pricing",
        entityId: projectId,
        details: { approved, approvedBy },
      });
      revalidateProjectPricing(projectId);
      return NextResponse.json({
        ok: true,
        pricingStatus: approved ? "approved" : "draft",
      });
    }

    // Settings / extras / bulk-tiers: staff+ edit. Read the existing row so a
    // partial patch (e.g. only extras) keeps the rest intact.
    const existing = await getProjectPricing(projectId);
    const pricing = parsePricing(
      {
        ...body,
        // Approval state is never set by a settings save — only the admin
        // "pricing" action above may change it.
        priceStatus: existing.priceStatus,
        priceApprovedAt: existing.priceApprovedAt,
        priceApprovedBy: existing.priceApprovedBy,
        // A partial patch keeps whatever it does not mention: sending only
        // extras must not wipe the tiers (or the fields themselves).
        packageBaseCharge: body.packageBaseCharge ?? existing.packageBaseCharge,
        componentMarkupPercent: body.componentMarkupPercent ?? existing.componentMarkupPercent,
        extras: body.extras ?? existing.extras,
        bulkTiers: body.bulkTiers ?? existing.bulkTiers,
        minimumOrder: body.minimumOrder ?? existing.minimumOrder,
        note: body.note ?? existing.note,
      },
      projectId
    );
    await saveProjectPricing(pricing);
    await logActivity({
      action: "project.pricing.saved",
      entityType: "project_pricing",
      entityId: projectId,
      details: { packageBaseCharge: pricing.packageBaseCharge },
    });
    revalidateProjectPricing(projectId);
    return NextResponse.json({ ok: true, pricing });
  } catch (error) {
    console.error("Admin project-pricing save failed", error);
    return NextResponse.json({ error: "Could not save the pricing." }, { status: 500 });
  }
}
