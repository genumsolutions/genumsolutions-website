import { createServiceClient, supabaseConfigured } from "./supabase/server";
import {
  defaultPrintContent,
  defaultPrintMaterials,
  defaultPrintSettings,
  isPrintQuoteStatus,
  type PrintCategory,
  type PrintContent,
  type PrintGalleryItem,
  type PrintMaterial,
  type PrintPromotion,
  type PrintQuoteRequest,
  type PrintSettings,
} from "./print";

// Server-side data access for the 3D print studio. Reads fall back to the
// bundled defaults so the storefront renders even before the migration runs;
// writes are only ever called from staff-gated API routes.

const str = (value: unknown, fallback = "") => (typeof value === "string" ? value : fallback);
const num = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const bool = (value: unknown, fallback = false) => (typeof value === "boolean" ? value : fallback);
const strings = (value: unknown) =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
const iso = (value: unknown) => (typeof value === "string" ? value : null);

function rowToCategory(row: Record<string, unknown>): PrintCategory {
  return {
    id: str(row.id),
    name: str(row.name),
    description: str(row.description),
    image: str(row.image_url),
    sortOrder: num(row.sort_order, 1000),
    active: bool(row.active, true),
  };
}

function categoryToRow(item: PrintCategory) {
  return {
    id: item.id,
    name: item.name,
    description: item.description,
    image_url: item.image,
    sort_order: num(item.sortOrder, 1000),
    active: item.active !== false,
    updated_at: new Date().toISOString(),
  };
}

function rowToMaterial(row: Record<string, unknown>): PrintMaterial {
  return {
    id: str(row.id),
    name: str(row.name),
    description: str(row.description),
    ratePerGram: num(row.rate_per_gram),
    note: str(row.note),
    sortOrder: num(row.sort_order, 1000),
    active: bool(row.active, true),
  };
}

function materialToRow(item: PrintMaterial) {
  return {
    id: item.id,
    name: item.name,
    description: item.description,
    rate_per_gram: Math.max(0, Math.round(num(item.ratePerGram))),
    note: item.note,
    sort_order: num(item.sortOrder, 1000),
    active: item.active !== false,
    updated_at: new Date().toISOString(),
  };
}

export function rowToSettings(row: Record<string, unknown> | null): PrintSettings {
  if (!row) return defaultPrintSettings;
  return {
    calculatorEnabled: bool(row.calculator_enabled, false),
    minimumOrder: num(row.minimum_order, defaultPrintSettings.minimumOrder),
    designBaseCharge: num(row.design_base_charge, defaultPrintSettings.designBaseCharge),
    finishingCharges: Array.isArray(row.finishing_charges)
      ? (row.finishing_charges as PrintSettings["finishingCharges"])
      : [],
    bulkTiers: Array.isArray(row.bulk_tiers) ? (row.bulk_tiers as PrintSettings["bulkTiers"]) : [],
    disclaimer: str(row.disclaimer, defaultPrintSettings.disclaimer),
    heroImage: str(row.hero_image),
    materialsIntro: str(row.materials_intro, defaultPrintSettings.materialsIntro),
  };
}

export function settingsToRow(settings: PrintSettings) {
  return {
    id: 1,
    calculator_enabled: settings.calculatorEnabled === true,
    minimum_order: Math.max(0, Math.round(num(settings.minimumOrder))),
    design_base_charge: Math.max(0, Math.round(num(settings.designBaseCharge))),
    finishing_charges: Array.isArray(settings.finishingCharges) ? settings.finishingCharges : [],
    bulk_tiers: Array.isArray(settings.bulkTiers) ? settings.bulkTiers : [],
    disclaimer: settings.disclaimer,
    hero_image: settings.heroImage,
    materials_intro: settings.materialsIntro,
    updated_at: new Date().toISOString(),
  };
}

function rowToPromotion(row: Record<string, unknown>): PrintPromotion {
  const type = str(row.discount_type, "none");
  return {
    id: str(row.id),
    title: str(row.title),
    body: str(row.body),
    image: str(row.image_url),
    ctaLabel: str(row.cta_label),
    ctaHref: str(row.cta_href),
    discountType: (["none", "percent", "flat"] as const).includes(
      type as PrintPromotion["discountType"]
    )
      ? (type as PrintPromotion["discountType"])
      : "none",
    discountValue: num(row.discount_value),
    startsAt: iso(row.starts_at),
    endsAt: iso(row.ends_at),
    active: bool(row.active, false),
    sortOrder: num(row.sort_order, 1000),
  };
}

function promotionToRow(item: PrintPromotion) {
  return {
    title: item.title,
    body: item.body,
    image_url: item.image,
    cta_label: item.ctaLabel,
    cta_href: item.ctaHref,
    discount_type: item.discountType,
    discount_value: Math.max(0, Math.round(num(item.discountValue))),
    starts_at: item.startsAt || null,
    ends_at: item.endsAt || null,
    active: item.active === true,
    sort_order: num(item.sortOrder, 1000),
    updated_at: new Date().toISOString(),
  };
}

function rowToGallery(row: Record<string, unknown>): PrintGalleryItem {
  return {
    id: str(row.id),
    image: str(row.image_url),
    caption: str(row.caption),
    category: str(row.category),
    featured: bool(row.featured),
    active: bool(row.active, true),
    sortOrder: num(row.sort_order, 1000),
  };
}

function galleryToRow(item: PrintGalleryItem) {
  return {
    image_url: item.image,
    caption: item.caption,
    category: item.category,
    featured: item.featured === true,
    active: item.active !== false,
    sort_order: num(item.sortOrder, 1000),
    updated_at: new Date().toISOString(),
  };
}

export function rowToQuote(row: Record<string, unknown>): PrintQuoteRequest {
  const status = str(row.status, "new");
  return {
    id: str(row.id),
    userId: typeof row.user_id === "string" ? row.user_id : null,
    name: str(row.name),
    email: str(row.email),
    phone: str(row.phone),
    description: str(row.description),
    material: str(row.material),
    quantity: num(row.quantity, 1),
    dimensions: str(row.dimensions),
    timeline: str(row.timeline),
    referenceUrls: strings(row.reference_urls),
    fileUrls: strings(row.file_urls),
    status: isPrintQuoteStatus(status) ? status : "new",
    adminNotes: str(row.admin_notes),
    createdAt: str(row.created_at),
  };
}

/**
 * Everything the public page needs, in one call. Each table is optional: a
 * missing migration or an empty table falls back to bundled defaults instead
 * of failing the render.
 */
export async function getPrintContent(
  options: { includeInactive?: boolean } = {}
): Promise<PrintContent> {
  const includeInactive = options.includeInactive === true;
  if (!supabaseConfigured()) return defaultPrintContent;
  const db = createServiceClient();
  const [settingsResult, categoriesResult, materialsResult, promosResult, galleryResult] =
    await Promise.all([
      db.from("print_settings").select("*").eq("id", 1).maybeSingle(),
      db.from("print_categories").select("*").order("sort_order", { ascending: true }),
      db.from("print_materials").select("*").order("sort_order", { ascending: true }),
      db.from("print_promotions").select("*").order("sort_order", { ascending: true }),
      db.from("print_gallery").select("*").order("sort_order", { ascending: true }),
    ]);

  if (settingsResult.error) console.warn("print_settings read failed", settingsResult.error);
  if (categoriesResult.error) console.warn("print_categories read failed", categoriesResult.error);
  if (materialsResult.error) console.warn("print_materials read failed", materialsResult.error);
  if (promosResult.error) console.warn("print_promotions read failed", promosResult.error);
  if (galleryResult.error) console.warn("print_gallery read failed", galleryResult.error);

  // Published surfaces hide inactive rows; the admin panel passes
  // includeInactive so a hidden category/material can still be edited/restored.
  const categories = (categoriesResult.data ?? [])
    .map((row) => rowToCategory(row as Record<string, unknown>))
    .filter((item) => (includeInactive || item.active) && item.id);
  const materials = (materialsResult.data ?? [])
    .map((row) => rowToMaterial(row as Record<string, unknown>))
    .filter((item) => (includeInactive || item.active) && item.id);

  return {
    settings: rowToSettings((settingsResult.data as Record<string, unknown> | null) ?? null),
    categories: categories.length > 0 ? categories : defaultPrintCategoriesFallback(),
    materials: materials.length > 0 ? materials : defaultPrintMaterials,
    // Live-window filtering happens here as well as in RLS, because the
    // service role bypasses RLS.
    promotions: (promosResult.data ?? []).map((row) =>
      rowToPromotion(row as Record<string, unknown>)
    ),
    gallery: (galleryResult.data ?? [])
      .map((row) => rowToGallery(row as Record<string, unknown>))
      .filter((item) => (includeInactive || item.active) && item.image),
  };
}

function defaultPrintCategoriesFallback(): PrintCategory[] {
  // Imported lazily through the shared defaults to keep a single source.
  return defaultPrintContent.categories;
}

/** Every quote, newest first, for the admin Requests panel. */
export async function getPrintQuoteRequests(limit = 200): Promise<PrintQuoteRequest[]> {
  if (!supabaseConfigured()) return [];
  const { data, error } = await createServiceClient()
    .from("print_quote_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(Math.min(500, Math.max(1, limit)));
  if (error) throw error;
  return (data ?? []).map((row) => rowToQuote(row as Record<string, unknown>));
}

/** Short-lived links for the private CAD/photo files attached to a quote. */
export async function signedQuoteFiles(paths: string[]): Promise<{ path: string; url: string }[]> {
  if (!supabaseConfigured() || paths.length === 0) return [];
  const db = createServiceClient();
  const { data } = await db.storage.from("print-quote-files").createSignedUrls(paths, 600);
  return (data ?? []).map((file) => ({
    path: file.path ?? "",
    url: file.signedUrl ?? "",
  }));
}

// ---- writes (staff routes only) -------------------------------------------

export async function savePrintCategory(item: PrintCategory) {
  const { error } = await createServiceClient()
    .from("print_categories")
    .upsert(categoryToRow(item));
  if (error) throw error;
}

export async function deletePrintCategory(id: string) {
  const { error } = await createServiceClient().from("print_categories").delete().eq("id", id);
  if (error) throw error;
}

export async function savePrintMaterial(item: PrintMaterial) {
  const { error } = await createServiceClient().from("print_materials").upsert(materialToRow(item));
  if (error) throw error;
}

export async function deletePrintMaterial(id: string) {
  const { error } = await createServiceClient().from("print_materials").delete().eq("id", id);
  if (error) throw error;
}

export async function savePrintSettings(settings: PrintSettings) {
  const { error } = await createServiceClient()
    .from("print_settings")
    .upsert(settingsToRow(settings));
  if (error) throw error;
}

export async function savePrintPromotion(item: PrintPromotion) {
  const db = createServiceClient();
  const row = promotionToRow(item);
  const query = item.id
    ? db.from("print_promotions").update(row).eq("id", item.id).select("id").single()
    : db.from("print_promotions").insert(row).select("id").single();
  const { data, error } = await query;
  if (error) throw error;
  return String((data as { id?: string } | null)?.id ?? item.id);
}

export async function deletePrintPromotion(id: string) {
  const { error } = await createServiceClient().from("print_promotions").delete().eq("id", id);
  if (error) throw error;
}

export async function savePrintGalleryItem(item: PrintGalleryItem) {
  const db = createServiceClient();
  const row = galleryToRow(item);
  const query = item.id
    ? db.from("print_gallery").update(row).eq("id", item.id).select("id").single()
    : db.from("print_gallery").insert(row).select("id").single();
  const { data, error } = await query;
  if (error) throw error;
  return String((data as { id?: string } | null)?.id ?? item.id);
}

export async function deletePrintGalleryItem(id: string) {
  const { error } = await createServiceClient().from("print_gallery").delete().eq("id", id);
  if (error) throw error;
}

export async function updatePrintQuote(
  id: string,
  values: { status?: string; adminNotes?: string }
) {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (values.status) patch.status = values.status;
  if (typeof values.adminNotes === "string") patch.admin_notes = values.adminNotes.slice(0, 4000);
  const { error } = await createServiceClient()
    .from("print_quote_requests")
    .update(patch)
    .eq("id", id);
  if (error) throw error;
}

export async function deletePrintQuote(id: string) {
  const { error } = await createServiceClient().from("print_quote_requests").delete().eq("id", id);
  if (error) throw error;
}

/** Insert the validated request + the uploaded storage paths. */
export async function insertPrintQuote(values: {
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
}) {
  const { data, error } = await createServiceClient()
    .from("print_quote_requests")
    .insert({
      user_id: values.userId,
      name: values.name,
      email: values.email,
      phone: values.phone,
      description: values.description,
      material: values.material,
      quantity: values.quantity,
      dimensions: values.dimensions,
      timeline: values.timeline,
      reference_urls: values.referenceUrls,
      file_urls: values.fileUrls,
      status: "new",
    })
    .select("id")
    .single();
  if (error) throw error;
  return String((data as { id?: string } | null)?.id ?? "");
}
