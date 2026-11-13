/** Project pricing — types + pure estimate calculator + published-price helpers.
 *
 * Mirrors lib/print.ts (the 3D print calculator) for project packages: a project
 * is priced from its linked catalog components (via the project_components join,
 * qty-aware) + a package base charge + optional extras + bulk tiers + a minimum
 * order. Draft by default (rates hidden, "rate on request"); approved to publish.
 *
 * No payment code touched. No secrets. Pure maths — easy to unit-test both sides.
 */

/** One optional extra a buyer can add to a project quote (training, assembly, …). */
export type ProjectPricingExtra = {
  id: string;
  name: string;
  amount: number; // NPR, flat add-on
};

/** Quantity → % off the components + extras subtotal (parallel to print bulk_tiers). */
export type ProjectPricingBulkTier = {
  minQty: number;
  discountPercent: number;
};

/** One project package's pricing rules (one row in public.project_pricing). */
export type ProjectPricing = {
  id: string; // = the project product id
  packageBaseCharge: number; // NPR, before components/extras
  componentMarkupPercent: number; // % markup on catalog component prices (0 = as-is)
  extras: ProjectPricingExtra[];
  bulkTiers: ProjectPricingBulkTier[];
  minimumOrder: number; // NPR; below it the quote is auto-elevated
  priceStatus: "draft" | "approved";
  priceApprovedAt: string | null;
  priceApprovedBy: string;
  note: string;
  updatedAt: string;
};

/** Linked component + the quantity the project needs (from project_components). */
export type ProjectComponentLink = {
  productId: string;
  quantity: number;
};

/** A linked component resolved to a public catalog product + the priced line. */
export type ProjectPricingLine = {
  productId: string;
  name: string;
  catalogPrice: number; // the catalog product's price (NPR), 0 if unknown
  unitPrice: number; // catalogPrice after markup (NPR)
  quantity: number;
  lineTotal: number; // unitPrice * quantity
};

/** Input for estimateProject — the pricing rules + the component links. */
export type ProjectPricingEstimateInput = {
  pricing: ProjectPricing;
  links: ProjectComponentLink[];
  /** Catalog prices for the linked component ids (from the products table). */
  catalogPrices: Map<string, number>;
};

/** A project price estimate (customer-facing). */
export type ProjectPricingEstimate = {
  available: boolean; // false when the pricing is draft or has no priced components
  packageBaseCharge: number;
  componentsTotal: number;
  extrasTotal: number;
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  beforeMinimum: number;
  total: number;
  minimumApplied: boolean;
  minimumOrder: number; // the minimum order value from the pricing rule (0 if none)
  reason: string; // short human-readable note (e.g. "Rate on request")
};

/** Customer-facing view of project pricing: prices are only published when an
 * admin approved them. Used by the page, the public API and the app so the three
 * can never disagree.
 */
export function publishedProjectPricing(pricing: ProjectPricing): ProjectPricing {
  if (pricing.priceStatus === "approved") return pricing;
  return {
    ...pricing,
    priceStatus: "draft" as const,
    // Keep the stored rules intact (the admin editor still sees them); only
    // the customer-facing view hides the computed price.
  };
}

/** Whether a published pricing row may be shown to customers at all.
 *
 * Approval is the only gate: a package can legitimately be priced purely from
 * its catalog components (no base charge, no markup), so callers must decide
 * whether the resulting estimate is meaningful by checking its total (the
 * detail page shows "rate on request" while every figure is still 0).
 */
export function projectPricingAvailable(pricing: ProjectPricing): boolean {
  return pricing.priceStatus === "approved";
}

/** Resolve a linked component to its priced line, given the catalog prices.
 *
 * The component's unit price = catalog price * (1 + markupPercent/100).
 * When the catalog price is 0 / unknown, the line is still listed but priced at 0
 * (the owner should link real catalog components with prices).
 */
export function resolveLine(
  link: ProjectComponentLink,
  catalogPrice: number,
  markupPercent: number
): ProjectPricingLine {
  const unitPrice = catalogPrice * (1 + markupPercent / 100);
  return {
    productId: link.productId,
    name: "", // filled in by the caller from the catalog product name
    catalogPrice,
    unitPrice: Math.round(unitPrice * 100) / 100,
    quantity: link.quantity,
    lineTotal: Math.round(link.quantity * unitPrice * 100) / 100,
  };
}

/** Estimate a project package from its pricing rules + linked components.
 *
 * Mirrors estimatePrint() (lib/print.ts) for projects:
 *   1. components total = Σ (catalogPrice * (1 + markup%) * qty)
 *   2. extras total = Σ extra.amount
 *   3. subtotal = packageBaseCharge + componentsTotal + extrasTotal
 *   4. bulk discount = first tier whose minQty <= total component qty
 *   5. beforeMinimum = subtotal - discountAmount
 *   6. total = max(beforeMinimum, minimumOrder)
 */
export function estimateProject(input: ProjectPricingEstimateInput): ProjectPricingEstimate {
  const { pricing, links, catalogPrices } = input;

  // Draft / not approved → no customer-facing price.
  if (pricing.priceStatus !== "approved") {
    return {
      available: false,
      packageBaseCharge: 0,
      componentsTotal: 0,
      extrasTotal: 0,
      subtotal: 0,
      discountPercent: 0,
      discountAmount: 0,
      beforeMinimum: 0,
      total: 0,
      minimumApplied: false,
      minimumOrder: 0,
      reason: "Rate on request",
    };
  }

  // Resolve each linked component to a priced line.
  const lines: ProjectPricingLine[] = links
    .map((link) => {
      const catalogPrice = catalogPrices.get(link.productId) ?? 0;
      return resolveLine(link, catalogPrice, pricing.componentMarkupPercent);
    })
    .filter((line) => line.quantity > 0);

  const componentsTotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const extrasTotal = pricing.extras.reduce((sum, e) => sum + Math.max(0, e.amount), 0);
  const packageBaseCharge = Math.max(0, pricing.packageBaseCharge);
  const subtotal = packageBaseCharge + componentsTotal + extrasTotal;

  // Bulk tier: first tier whose minQty <= total component quantity.
  const totalComponentQty = lines.reduce((sum, line) => sum + line.quantity, 0);
  const sortedTiers = [...pricing.bulkTiers].sort((a, b) => b.minQty - a.minQty);
  let discountPercent = 0;
  for (const tier of sortedTiers) {
    if (totalComponentQty >= tier.minQty) {
      discountPercent = tier.discountPercent;
      break;
    }
  }
  // Cap discount at the subtotal (never go negative).
  const discountAmount = Math.min(subtotal, Math.round((subtotal * discountPercent) / 100));
  const beforeMinimum = subtotal - discountAmount;
  const total = Math.max(beforeMinimum, pricing.minimumOrder);

  return {
    available: true,
    packageBaseCharge,
    componentsTotal: Math.round(componentsTotal * 100) / 100,
    extrasTotal,
    subtotal: Math.round(subtotal * 100) / 100,
    discountPercent,
    discountAmount,
    beforeMinimum: Math.round(beforeMinimum * 100) / 100,
    total: Math.round(total * 100) / 100,
    minimumApplied: beforeMinimum < pricing.minimumOrder && pricing.minimumOrder > 0,
    minimumOrder: pricing.minimumOrder,
    reason: "",
  };
}

/** Default pricing row: nothing set, draft ("rate on request").
 *
 * Lives here (not in the server-only store) because client components — the
 * public detail page and the admin editor — need it too.
 */
export const defaultProjectPricing: ProjectPricing = {
  id: "",
  packageBaseCharge: 0,
  componentMarkupPercent: 0,
  extras: [],
  bulkTiers: [],
  minimumOrder: 0,
  priceStatus: "draft",
  priceApprovedAt: null,
  priceApprovedBy: "",
  note: "",
  updatedAt: new Date().toISOString(),
};

/** Format NPR for display (mirror of the print calculator's formatNPR). */
export function formatNPR(value: number): string {
  return `NPR ${Math.round(value).toLocaleString("en-IN")}`;
}
