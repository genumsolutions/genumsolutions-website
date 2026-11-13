/**
 * 3D print studio — shared types and pure pricing helpers.
 *
 * Kept free of server imports so the admin panel, the storefront calculator
 * (client component) and the tests all use the SAME maths. Database access
 * lives in lib/print-store.ts.
 *
 * Money rule (2026-11-13): the calculator ships DISABLED and material rates
 * start at 0 ("not published"). Nothing here invents a price — an estimate is
 * only offered when the owner has entered a rate and switched the calculator
 * on in Admin → 3D Products → Pricing.
 */

export type PrintCategory = {
  id: string;
  name: string;
  description: string;
  image: string;
  sortOrder: number;
  active: boolean;
};

export type PrintMaterial = {
  id: string;
  name: string;
  description: string;
  ratePerGram: number;
  note: string;
  sortOrder: number;
  active: boolean;
};

export type PrintFinishing = { id: string; name: string; amount: number };
export type PrintBulkTier = { minQty: number; discountPercent: number };

export type PrintSettings = {
  calculatorEnabled: boolean;
  minimumOrder: number;
  designBaseCharge: number;
  finishingCharges: PrintFinishing[];
  bulkTiers: PrintBulkTier[];
  disclaimer: string;
  heroImage: string;
  materialsIntro: string;
};

export type PrintPromotion = {
  id: string;
  title: string;
  body: string;
  image: string;
  ctaLabel: string;
  ctaHref: string;
  discountType: "none" | "percent" | "flat";
  discountValue: number;
  startsAt: string | null;
  endsAt: string | null;
  active: boolean;
  sortOrder: number;
};

export type PrintGalleryItem = {
  id: string;
  image: string;
  caption: string;
  category: string;
  featured: boolean;
  active: boolean;
  sortOrder: number;
};

// Same string format as lib/catalog.ts formatNPR — kept here so client print
// components never pull the bundled catalog into their chunk.
export const formatNPR = (value: number) => `NPR ${value.toLocaleString("en-IN")}`;

export const PRINT_QUOTE_STATUSES = [
  "new",
  "reviewing",
  "quoted",
  "approved",
  "printing",
  "ready",
  "completed",
  "cancelled",
] as const;

export type PrintQuoteStatus = (typeof PRINT_QUOTE_STATUSES)[number];

export const PRINT_QUOTE_STATUS_LABELS: Record<PrintQuoteStatus, string> = {
  new: "New",
  reviewing: "Reviewing",
  quoted: "Quoted",
  approved: "Approved",
  printing: "Printing",
  ready: "Ready",
  completed: "Completed",
  cancelled: "Cancelled",
};

export type PrintQuoteRequest = {
  id: string;
  userId: string | null;
  name: string;
  email: string;
  phone: string;
  description: string;
  material: string;
  quantity: number;
  dimensions: string;
  timeline: string;
  referenceUrls: string[];
  fileUrls: string[];
  status: PrintQuoteStatus;
  adminNotes: string;
  createdAt: string;
};

export type PrintContent = {
  settings: PrintSettings;
  categories: PrintCategory[];
  materials: PrintMaterial[];
  promotions: PrintPromotion[];
  gallery: PrintGalleryItem[];
};

// Bundled fallback — used when Supabase is not configured or a table is still
// empty, so /3d-printing never renders blank. These are DEFAULTS, not data:
// rates stay 0 and the calculator stays off until the owner publishes them.
export const defaultPrintSettings: PrintSettings = {
  calculatorEnabled: false,
  minimumOrder: 300,
  designBaseCharge: 2500,
  finishingCharges: [],
  bulkTiers: [],
  disclaimer:
    "Estimates are indicative only. Final price depends on the reviewed model, supports, infill, orientation and finish.",
  heroImage: "",
  materialsIntro:
    "We print in FDM. PLA is the everyday choice for display and teaching models; PETG is the tougher option for parts that take a knock. Send a file and we will recommend a material and orientation before printing.",
};

export const defaultPrintCategories: PrintCategory[] = [
  {
    id: "home-decor",
    name: "Home Decor",
    description:
      "Vases, planters, wall pieces and tabletop objects printed in the finish you choose.",
    image: "",
    sortOrder: 1,
    active: true,
  },
  {
    id: "educational-models",
    name: "Educational Models",
    description:
      "Teaching models and classroom sets for physics, biology, robotics and design classes.",
    image: "",
    sortOrder: 2,
    active: true,
  },
  {
    id: "prototypes",
    name: "Prototypes & Enclosures",
    description: "Fit checks, housings and brackets that let you test a design before tooling.",
    image: "",
    sortOrder: 3,
    active: true,
  },
  {
    id: "replacement-parts",
    name: "Replacement Parts",
    description: "One-off parts for equipment that is otherwise hard or slow to replace.",
    image: "",
    sortOrder: 4,
    active: true,
  },
  {
    id: "scale-models",
    name: "Scale & Architectural Models",
    description: "Site models, building sections and presentation pieces built to scale.",
    image: "",
    sortOrder: 5,
    active: true,
  },
  {
    id: "gifts",
    name: "Gifts & Personalised",
    description: "Name plates, trophies, keepsakes and small personalised runs.",
    image: "",
    sortOrder: 6,
    active: true,
  },
  {
    id: "jigs-fixtures",
    name: "Jigs & Fixtures",
    description: "Shop-floor aids, alignment guides and repeatable production fixtures.",
    image: "",
    sortOrder: 7,
    active: true,
  },
];

export const defaultPrintMaterials: PrintMaterial[] = [
  {
    id: "pla",
    name: "PLA",
    description:
      "The everyday choice: crisp detail, easy to print, best for display models, teaching aids and prototypes that will not sit in a hot car.",
    ratePerGram: 0,
    note: "Rate pending owner approval.",
    sortOrder: 1,
    active: true,
  },
  {
    id: "petg",
    name: "PETG",
    description:
      "Tougher and slightly flexible with better heat and water resistance — a good fit for brackets, jigs and parts that take a knock.",
    ratePerGram: 0,
    note: "Rate pending owner approval.",
    sortOrder: 2,
    active: true,
  },
];

export const defaultPrintContent: PrintContent = {
  settings: defaultPrintSettings,
  categories: defaultPrintCategories,
  materials: defaultPrintMaterials,
  promotions: [],
  gallery: [],
};

/** Print-only extras a 3D product row can carry (see products table). */
export type PrintProductFields = {
  printCategory?: string;
  material?: string;
  dimensions?: string;
  weightGrams?: number;
  customization?: string[];
  featuredPrint?: boolean;
};

export const PRINT_CUSTOMIZATION_FALLBACK = [
  "Material choice (PLA / PETG)",
  "Size scaling",
  "Colour and finish",
  "Name or text engraving",
];

export type PrintEstimateInput = {
  weightGrams: number;
  quantity: number;
  materialRatePerGram: number;
  designRequested?: boolean;
  finishingIds?: string[];
  settings: PrintSettings;
};

export type PrintEstimate = {
  available: boolean;
  /** Grams billed (weight × quantity). */
  totalGrams: number;
  quantity: number;
  materialCost: number;
  finishingCost: number;
  designCost: number;
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  total: number;
  minimumApplied: boolean;
  reason?: string;
};

const roundRupees = (value: number) => Math.max(0, Math.round(value));

/**
 * Deterministic estimate used by the storefront calculator and the tests.
 * `available: false` means "show request-a-quote", never "NPR 0".
 */
export function estimatePrint(input: PrintEstimateInput): PrintEstimate {
  const settings = input.settings;
  const weight = Math.max(0, Number(input.weightGrams) || 0);
  const quantity = Math.max(1, Math.floor(Number(input.quantity) || 1));
  const rate = Math.max(0, Number(input.materialRatePerGram) || 0);
  const base: PrintEstimate = {
    available: false,
    totalGrams: weight * quantity,
    quantity,
    materialCost: 0,
    finishingCost: 0,
    designCost: 0,
    subtotal: 0,
    discountPercent: 0,
    discountAmount: 0,
    total: 0,
    minimumApplied: false,
  };

  if (weight <= 0) return { ...base, reason: "Enter the printed weight in grams." };
  if (rate <= 0) return { ...base, reason: "Online pricing for this material is being finalised." };

  const materialCost = roundRupees(rate * weight * quantity);
  const finishingCost = roundRupees(
    (settings.finishingCharges ?? [])
      .filter((charge) => (input.finishingIds ?? []).includes(charge.id))
      .reduce((sum, charge) => sum + Math.max(0, Number(charge.amount) || 0), 0) * quantity
  );
  const designCost = input.designRequested ? roundRupees(settings.designBaseCharge) : 0;
  const subtotal = materialCost + finishingCost + designCost;

  const tier = [...(settings.bulkTiers ?? [])]
    .filter((t) => quantity >= Math.max(1, Number(t.minQty) || 0))
    .sort((a, b) => b.minQty - a.minQty)[0];
  const discountPercent = tier ? Math.min(90, Math.max(0, Number(tier.discountPercent) || 0)) : 0;
  // The design charge is effort, not volume: discounts apply to print + finish.
  const discountAmount = roundRupees(((materialCost + finishingCost) * discountPercent) / 100);
  const beforeMinimum = Math.max(0, subtotal - discountAmount);
  const minimumApplied = beforeMinimum < settings.minimumOrder;
  const total = roundRupees(minimumApplied ? settings.minimumOrder : beforeMinimum);

  return {
    available: true,
    totalGrams: base.totalGrams,
    quantity,
    materialCost,
    finishingCost,
    designCost,
    subtotal,
    discountPercent,
    discountAmount,
    total,
    minimumApplied,
  };
}

/** The promotion to show above the fold: first live, in-window, active row. */
export function activePromotion(
  promotions: PrintPromotion[],
  now: Date = new Date()
): PrintPromotion | null {
  const time = now.getTime();
  return (
    [...promotions]
      .filter((promo) => {
        if (!promo.active) return false;
        if (promo.startsAt && new Date(promo.startsAt).getTime() > time) return false;
        if (promo.endsAt && new Date(promo.endsAt).getTime() < time) return false;
        return true;
      })
      .sort((a, b) => a.sortOrder - b.sortOrder)[0] ?? null
  );
}

export function promotionBadge(promo: PrintPromotion): string {
  if (promo.discountType === "percent" && promo.discountValue > 0)
    return `${promo.discountValue}% off`;
  if (promo.discountType === "flat" && promo.discountValue > 0)
    return `NPR ${promo.discountValue.toLocaleString("en-IN")} off`;
  return "";
}

/** Formats a quote status for the admin + customer-facing copy. */
export function quoteStatusLabel(status: string): string {
  return PRINT_QUOTE_STATUS_LABELS[status as PrintQuoteStatus] ?? status;
}

export function isPrintQuoteStatus(value: string): value is PrintQuoteStatus {
  return (PRINT_QUOTE_STATUSES as readonly string[]).includes(value);
}
