import { NextResponse } from "next/server";
import { isAdminRequest, isStaffRequest } from "../../../../lib/admin";
import { logActivity } from "../../../../lib/activity";
import { revalidatePrint } from "../../../../lib/revalidate";
import {
  getPrintContent,
  getPrintCosting,
  getPrintQuoteRequests,
  getPrintSettings,
  signedQuoteFiles,
  savePrintCategory,
  savePrintGalleryItem,
  savePrintMaterial,
  savePrintPromotion,
  savePrintSettings,
  savePrintCosting,
  savePrintService,
  setPrintPricingApproval,
  deletePrintCategory,
  deletePrintGalleryItem,
  deletePrintMaterial,
  deletePrintPromotion,
  deletePrintQuote,
  deletePrintService,
  updatePrintQuote,
} from "../../../../lib/print-store";
import {
  isPrintQuoteStatus,
  PRINT_QUOTE_STATUSES,
  type PrintCategory,
  type PrintGalleryItem,
  type PrintMaterial,
  type PrintPromotion,
  type PrintSettings,
} from "../../../../lib/print";
import { defaultPrintCosting, type PrintCosting } from "../../../../lib/print-costing";
import { getSessionUser } from "../../../../lib/supabase/server";

export const runtime = "nodejs";

const slug = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 80);

const text = (value: unknown, max = 500) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

const number = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const dateOrNull = (value: unknown) => {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

/** Costing inputs are internal money: accept numbers only, clamp to sane ranges. */
function parseCosting(item: Record<string, unknown>): PrintCosting {
  const clamp = (value: unknown, max: number) => Math.min(max, Math.max(0, number(value, 0)));
  return {
    filamentCostPerGram: Math.round(clamp(item.filamentCostPerGram, 10000) * 100) / 100,
    wastagePercent: Math.round(clamp(item.wastagePercent, 100)),
    electricityRatePerKwh: Math.round(clamp(item.electricityRatePerKwh, 10000) * 100) / 100,
    printerWatts: Math.round(clamp(item.printerWatts, 100000)),
    machineCost: Math.round(clamp(item.machineCost, 100000000)),
    machineLifeHours: Math.round(clamp(item.machineLifeHours, 1000000)),
    maintenancePerHour: Math.round(clamp(item.maintenancePerHour, 100000) * 100) / 100,
    labourPerHour: Math.round(clamp(item.labourPerHour, 100000) * 100) / 100,
    packagingPerJob: Math.round(clamp(item.packagingPerJob, 1000000)),
    paymentFeePercent: Math.round(clamp(item.paymentFeePercent, 100) * 100) / 100,
    overheadPerMonth: Math.round(clamp(item.overheadPerMonth, 100000000)),
    monthlyOrderTarget: Math.round(clamp(item.monthlyOrderTarget, 1000000)),
    targetMarginPercent: Math.round(clamp(item.targetMarginPercent, 95)),
    notes: text(item.notes, 2000),
  };
}

export async function GET(request: Request) {
  if (!(await isStaffRequest()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const params = new URL(request.url).searchParams;
    const quoteId = params.get("files");
    if (quoteId) {
      const quotes = await getPrintQuoteRequests(500);
      const quote = quotes.find((item) => item.id === quoteId);
      if (!quote) return NextResponse.json({ error: "Quote not found." }, { status: 404 });
      return NextResponse.json({ files: await signedQuoteFiles(quote.fileUrls) });
    }

    const [content, quotes, costing] = await Promise.all([
      getPrintContent({ includeInactive: true }),
      getPrintQuoteRequests(200),
      getPrintCosting(),
    ]);
    return NextResponse.json({
      ...content,
      quotes,
      costing: costing ?? defaultPrintCosting,
      statuses: PRINT_QUOTE_STATUSES,
    });
  } catch (error) {
    console.error("Admin print read failed", error);
    return NextResponse.json({ error: "Could not load 3D print content." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  if (!(await isStaffRequest()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = (await request.json().catch(() => null)) as {
      resource?: string;
      item?: Record<string, unknown>;
    } | null;
    const resource = body?.resource ?? "";
    const item = body?.item ?? {};

    if (resource === "categories") {
      const id = slug(item.id);
      const name = text(item.name, 80);
      if (!id || !name)
        return NextResponse.json({ error: "Category needs an id and a name." }, { status: 400 });
      const category: PrintCategory = {
        id,
        name,
        description: text(item.description, 400),
        image: text(item.image, 600),
        sortOrder: number(item.sortOrder, 1000),
        active: item.active !== false,
      };
      await savePrintCategory(category);
      await logActivity({
        action: "print.category.saved",
        entityType: "print_category",
        entityId: id,
        details: { name },
      });
      revalidatePrint();
      return NextResponse.json({ ok: true, item: category });
    }

    if (resource === "materials") {
      const id = slug(item.id);
      const name = text(item.name, 80);
      if (!id || !name)
        return NextResponse.json({ error: "Material needs an id and a name." }, { status: 400 });
      const rate = number(item.ratePerGram);
      if (rate < 0)
        return NextResponse.json({ error: "Rate cannot be negative." }, { status: 400 });
      const material: PrintMaterial = {
        id,
        name,
        description: text(item.description, 600),
        ratePerGram: Math.round(rate),
        note: text(item.note, 200),
        sortOrder: number(item.sortOrder, 1000),
        active: item.active !== false,
      };
      await savePrintMaterial(material);
      await logActivity({
        action: "print.material.saved",
        entityType: "print_material",
        entityId: id,
        details: { ratePerGram: material.ratePerGram },
      });
      revalidatePrint();
      return NextResponse.json({ ok: true, item: material });
    }

    if (resource === "settings") {
      // Merge with the stored row: a save that omits a field must keep it
      // (a partial save used to blank the finishing charges, the bulk tiers
      // and the disclaimer). `undefined` = not sent; `null` is an explicit
      // clear for the string fields.
      const existing = await getPrintSettings();
      const settings: PrintSettings = {
        calculatorEnabled:
          typeof item.calculatorEnabled === "boolean"
            ? item.calculatorEnabled
            : existing.calculatorEnabled,
        minimumOrder:
          item.minimumOrder === undefined
            ? existing.minimumOrder
            : Math.max(0, Math.round(number(item.minimumOrder))),
        designBaseCharge:
          item.designBaseCharge === undefined
            ? existing.designBaseCharge
            : Math.max(0, Math.round(number(item.designBaseCharge))),
        finishingCharges: Array.isArray(item.finishingCharges)
          ? (item.finishingCharges as PrintSettings["finishingCharges"])
              .filter((charge) => charge && typeof charge.name === "string")
              .map((charge) => ({
                id: slug(charge.id) || slug(charge.name),
                name: text(charge.name, 60),
                amount: Math.max(0, Math.round(number(charge.amount))),
              }))
              .slice(0, 20)
          : existing.finishingCharges,
        bulkTiers: Array.isArray(item.bulkTiers)
          ? (item.bulkTiers as PrintSettings["bulkTiers"])
              .map((tier) => ({
                minQty: Math.max(1, Math.round(number(tier.minQty, 1))),
                discountPercent: Math.min(90, Math.max(0, number(tier.discountPercent))),
              }))
              .slice(0, 10)
          : existing.bulkTiers,
        disclaimer:
          item.disclaimer === undefined ? existing.disclaimer : text(item.disclaimer, 600),
        heroImage: item.heroImage === undefined ? existing.heroImage : text(item.heroImage, 600),
        materialsIntro:
          item.materialsIntro === undefined
            ? existing.materialsIntro
            : text(item.materialsIntro, 1200),
        // Approval is owned by the dedicated `pricing` action; a plain settings
        // save must never flip it or erase who approved it.
        pricingStatus: existing.pricingStatus,
        pricingApprovedAt: existing.pricingApprovedAt,
        pricingApprovedBy: existing.pricingApprovedBy,
      };
      await savePrintSettings(settings);
      await logActivity({
        action: "print.settings.saved",
        entityType: "print_settings",
        entityId: "1",
        details: { calculatorEnabled: settings.calculatorEnabled },
      });
      revalidatePrint();
      return NextResponse.json({ ok: true, item: settings });
    }

    if (resource === "promotions") {
      const title = text(item.title, 120);
      if (!title) return NextResponse.json({ error: "Promotion needs a title." }, { status: 400 });
      const discountType = ["none", "percent", "flat"].includes(String(item.discountType))
        ? (String(item.discountType) as PrintPromotion["discountType"])
        : "none";
      const promotion: PrintPromotion = {
        id: text(item.id, 60),
        title,
        body: text(item.body, 600),
        image: text(item.image, 600),
        ctaLabel: text(item.ctaLabel, 40),
        ctaHref: text(item.ctaHref, 300),
        discountType,
        discountValue: Math.max(0, Math.round(number(item.discountValue))),
        startsAt: dateOrNull(item.startsAt),
        endsAt: dateOrNull(item.endsAt),
        active: item.active === true,
        sortOrder: number(item.sortOrder, 1000),
      };
      const id = await savePrintPromotion(promotion);
      await logActivity({
        action: "print.promotion.saved",
        entityType: "print_promotion",
        entityId: id,
        details: { title, active: promotion.active },
      });
      revalidatePrint();
      return NextResponse.json({ ok: true, item: { ...promotion, id } });
    }

    if (resource === "gallery") {
      const image = text(item.image, 600);
      if (!image)
        return NextResponse.json({ error: "Gallery item needs an image." }, { status: 400 });
      const galleryItem: PrintGalleryItem = {
        id: text(item.id, 60),
        image,
        caption: text(item.caption, 160),
        category: text(item.category, 80),
        featured: item.featured === true,
        active: item.active !== false,
        sortOrder: number(item.sortOrder, 1000),
      };
      const id = await savePrintGalleryItem(galleryItem);
      await logActivity({
        action: "print.gallery.saved",
        entityType: "print_gallery",
        entityId: id,
      });
      revalidatePrint();
      return NextResponse.json({ ok: true, item: { ...galleryItem, id } });
    }

    if (resource === "services") {
      const title = text(item.title, 80);
      if (!title) return NextResponse.json({ error: "Service needs a title." }, { status: 400 });
      const id = await savePrintService({
        id: text(item.id, 60) || undefined,
        title,
        description: text(item.description, 600),
        priceNote: text(item.priceNote, 80),
        sortOrder: number(item.sortOrder, 1000),
        active: item.active !== false,
      });
      await logActivity({
        action: "print.service.saved",
        entityType: "print_service",
        entityId: id,
        details: { title, active: item.active !== false },
      });
      revalidatePrint();
      return NextResponse.json({ ok: true, id });
    }

    if (resource === "costing") {
      const costing = parseCosting(item);
      await savePrintCosting(costing);
      await logActivity({
        action: "print.costing.saved",
        entityType: "print_costing",
        entityId: "1",
        // Internal costs stay out of the activity feed; the change is logged.
        details: { targetMarginPercent: costing.targetMarginPercent },
      });
      return NextResponse.json({ ok: true, item: costing });
    }

    if (resource === "pricing") {
      if (!(await isAdminRequest()))
        return NextResponse.json(
          { error: "Only administrators can approve or withdraw prices." },
          { status: 403 }
        );
      const approved = item.approved === true;
      const user = await getSessionUser();
      const approvedBy = approved ? text(user?.email ?? "admin", 120) || "admin" : "";
      await setPrintPricingApproval({ approved, approvedBy });
      await logActivity({
        action: approved ? "print.pricing.approved" : "print.pricing.withdrawn",
        entityType: "print_settings",
        entityId: "1",
        details: { approved, approvedBy },
      });
      revalidatePrint();
      return NextResponse.json({ ok: true, pricingStatus: approved ? "approved" : "draft" });
    }

    if (resource === "quotes") {
      const id = text(item.id, 60);
      if (!id) return NextResponse.json({ error: "Quote id is required." }, { status: 400 });
      const status = text(item.status, 20);
      if (status && !isPrintQuoteStatus(status))
        return NextResponse.json({ error: "Unknown quote status." }, { status: 400 });
      await updatePrintQuote(id, {
        status: status || undefined,
        adminNotes: typeof item.adminNotes === "string" ? item.adminNotes : undefined,
        quotedAmount: typeof item.quotedAmount === "number" ? item.quotedAmount : undefined,
        estimatedGrams: typeof item.estimatedGrams === "number" ? item.estimatedGrams : undefined,
        printHours: typeof item.printHours === "number" ? item.printHours : undefined,
        reprint: typeof item.reprint === "boolean" ? item.reprint : undefined,
      });
      await logActivity({
        action: "print.quote.updated",
        entityType: "print_quote",
        entityId: id,
        details: { status },
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown resource." }, { status: 400 });
  } catch (error) {
    console.error("Admin print save failed", error);
    return NextResponse.json({ error: "Could not save the change." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!(await isStaffRequest()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdminRequest()))
    return NextResponse.json({ error: "Only administrators can delete." }, { status: 403 });
  try {
    const params = new URL(request.url).searchParams;
    const resource = params.get("resource") ?? "";
    const id = params.get("id") ?? "";
    if (!id) return NextResponse.json({ error: "An id is required." }, { status: 400 });

    if (resource === "categories") await deletePrintCategory(id);
    else if (resource === "materials") await deletePrintMaterial(id);
    else if (resource === "promotions") await deletePrintPromotion(id);
    else if (resource === "gallery") await deletePrintGalleryItem(id);
    else if (resource === "services") await deletePrintService(id);
    else if (resource === "quotes") await deletePrintQuote(id);
    else return NextResponse.json({ error: "Unknown resource." }, { status: 400 });

    await logActivity({
      action: `print.${resource}.deleted`,
      entityType: `print_${resource}`,
      entityId: id,
    });
    revalidatePrint();
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Admin print delete failed", error);
    return NextResponse.json({ error: "Could not delete the item." }, { status: 500 });
  }
}
