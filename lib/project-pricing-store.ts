/** Server-side data access for project pricing.
 *
 * Reads fall back to a default draft row so the storefront renders even before
 * the migration runs; writes are only ever called from staff-gated API routes.
 */

import { createServiceClient, supabaseConfigured } from "./supabase/server";
import {
  defaultProjectPricing,
  type ProjectPricing,
  publishedProjectPricing,
} from "./project-pricing";

// ---- row <-> object mapping (snake_case DB <-> camelCase app) ----

const str = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value : fallback;
const num = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const iso = (value: unknown): string | null => (typeof value === "string" ? value : null);
const arr = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const isApproved = (value: unknown): boolean => value === "approved";

function rowToPricing(row: Record<string, unknown> | null): ProjectPricing {
  if (!row) return defaultProjectPricing;
  return {
    id: str(row.id),
    packageBaseCharge: num(row.package_base_charge, 0),
    componentMarkupPercent: num(row.component_markup_percent, 0),
    extras: (arr(row.extras) as unknown[])
      .filter((e): e is Record<string, unknown> => typeof e === "object" && e !== null)
      .map((e) => ({
        id: str(e.id, str(e.name)),
        name: str(e.name),
        amount: Math.max(0, num(e.amount, 0)),
      }))
      .slice(0, 20),
    bulkTiers: (arr(row.bulk_tiers) as unknown[])
      .filter((t): t is Record<string, unknown> => typeof t === "object" && t !== null)
      .map((t) => ({
        minQty: Math.max(1, num(t.minQty, 1)),
        discountPercent: Math.min(90, Math.max(0, num(t.discountPercent, 0))),
      }))
      .slice(0, 10),
    minimumOrder: num(row.minimum_order, 0),
    priceStatus: isApproved(row.price_status) ? ("approved" as const) : ("draft" as const),
    priceApprovedAt: iso(row.price_approved_at),
    priceApprovedBy: str(row.price_approved_by),
    note: str(row.note),
    updatedAt: iso(row.updated_at) ?? new Date().toISOString(),
  };
}

function pricingToRow(pricing: ProjectPricing) {
  return {
    id: pricing.id,
    package_base_charge: Math.max(0, Math.round(num(pricing.packageBaseCharge))),
    component_markup_percent: Math.max(
      0,
      Math.min(500, Math.round(num(pricing.componentMarkupPercent)))
    ),
    extras: pricing.extras
      .filter((e) => e && typeof e.name === "string")
      .map((e) => ({
        id: e.id || e.name,
        name: e.name,
        amount: Math.max(0, Math.round(num(e.amount))),
      }))
      .slice(0, 20),
    bulk_tiers: pricing.bulkTiers
      .filter((t) => t.minQty > 0)
      .map((t) => ({
        minQty: Math.max(1, Math.round(num(t.minQty))),
        discountPercent: Math.min(90, Math.max(0, Math.round(num(t.discountPercent)))),
      }))
      .slice(0, 10),
    minimum_order: Math.max(0, Math.round(num(pricing.minimumOrder))),
    price_status: pricing.priceStatus === "approved" ? "approved" : "draft",
    price_approved_at: pricing.priceApprovedAt,
    price_approved_by: str(pricing.priceApprovedBy),
    note: pricing.note,
    updated_at: new Date().toISOString(),
  };
}

// ---- reads ----

/** Read one project's pricing row (staff+ only — sees draft + approved). */
export async function getProjectPricing(projectId: string): Promise<ProjectPricing> {
  if (!supabaseConfigured()) return defaultProjectPricing;
  try {
    const { data, error } = await createServiceClient()
      .from("project_pricing")
      .select("*")
      .eq("id", projectId)
      .maybeSingle();
    if (error) throw error;
    return rowToPricing(data);
  } catch (error) {
    console.error(`project_pricing read failed for ${projectId}`, error);
    return defaultProjectPricing;
  }
}

/** Public read: only returns the row when it is approved (RLS-enforced on the
 * table already, but we also gate here so the public API is explicit). */
export async function getPublishedProjectPricing(
  projectId: string
): Promise<ProjectPricing | null> {
  if (!supabaseConfigured()) return null;
  try {
    const { data, error } = await createServiceClient()
      .from("project_pricing")
      .select("*")
      .eq("id", projectId)
      .eq("price_status", "approved")
      .maybeSingle();
    if (error) throw error;
    return data ? publishedProjectPricing(rowToPricing(data)) : null;
  } catch (error) {
    console.error(`project_pricing public read failed for ${projectId}`, error);
    return null;
  }
}

/** List pricing rows for all project packages (staff+ only). */
export async function listProjectPricing(): Promise<ProjectPricing[]> {
  if (!supabaseConfigured()) return [];
  try {
    const { data, error } = await createServiceClient()
      .from("project_pricing")
      .select("*")
      .order("id", { ascending: true });
    if (error) throw error;
    return (data ?? []).map(rowToPricing);
  } catch (error) {
    console.error("project_pricing list failed", error);
    return [];
  }
}

// ---- writes (staff routes only) ----

export async function saveProjectPricing(pricing: ProjectPricing): Promise<void> {
  if (!supabaseConfigured()) return;
  const { error } = await createServiceClient()
    .from("project_pricing")
    .upsert(pricingToRow(pricing));
  if (error) throw error;
}

/** Approve or withdraw a project package's pricing (admin only). */
export async function setProjectPricingApproval(values: {
  projectId: string;
  approved: boolean;
  approvedBy: string;
}): Promise<void> {
  if (!supabaseConfigured()) return;
  // Upsert, not update: a project package created after the seed has no
  // pricing row yet, and approving it must not silently affect zero rows.
  // Every other column has a default, so the insert carries only these fields.
  const { error } = await createServiceClient()
    .from("project_pricing")
    .upsert({
      id: values.projectId,
      price_status: values.approved ? "approved" : "draft",
      price_approved_at: values.approved ? new Date().toISOString() : null,
      price_approved_by: values.approved ? values.approvedBy : "",
      updated_at: new Date().toISOString(),
    });
  if (error) throw error;
}
