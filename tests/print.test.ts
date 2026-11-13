import { describe, expect, it } from "vitest";
import {
  activePromotion,
  defaultPrintSettings,
  estimatePrint,
  promotionBadge,
  type PrintPromotion,
  type PrintSettings,
} from "../lib/print";
import {
  MAX_QUOTE_FILES,
  quoteFileExtension,
  quoteStorageName,
  validateQuoteDraft,
} from "../lib/print-quote";

const settings: PrintSettings = {
  ...defaultPrintSettings,
  calculatorEnabled: true,
  minimumOrder: 300,
  designBaseCharge: 2500,
  finishingCharges: [{ id: "sanded", name: "Sanded", amount: 200 }],
  bulkTiers: [{ minQty: 10, discountPercent: 10 }],
};

describe("estimatePrint", () => {
  it("prices material, finishing and quantity", () => {
    const estimate = estimatePrint({
      weightGrams: 100,
      quantity: 2,
      materialRatePerGram: 15,
      finishingIds: ["sanded"],
      settings,
    });
    expect(estimate.available).toBe(true);
    expect(estimate.totalGrams).toBe(200);
    expect(estimate.materialCost).toBe(3000);
    expect(estimate.finishingCost).toBe(400);
    expect(estimate.subtotal).toBe(3400);
    expect(estimate.total).toBe(3400);
    expect(estimate.minimumApplied).toBe(false);
  });

  it("applies the minimum order instead of publishing a lower price", () => {
    const estimate = estimatePrint({
      weightGrams: 10,
      quantity: 1,
      materialRatePerGram: 15,
      settings,
    });
    expect(estimate.subtotal).toBe(150);
    expect(estimate.minimumApplied).toBe(true);
    expect(estimate.total).toBe(300);
  });

  it("never returns a price while the material rate is unpublished (0)", () => {
    const estimate = estimatePrint({
      weightGrams: 100,
      quantity: 1,
      materialRatePerGram: 0,
      settings,
    });
    expect(estimate.available).toBe(false);
    expect(estimate.total).toBe(0);
    expect(estimate.reason).toMatch(/finalised/i);
  });

  it("requires a printed weight", () => {
    const estimate = estimatePrint({
      weightGrams: 0,
      quantity: 1,
      materialRatePerGram: 15,
      settings,
    });
    expect(estimate.available).toBe(false);
  });

  it("discounts print + finishing at a bulk tier but not the design charge", () => {
    const estimate = estimatePrint({
      weightGrams: 100,
      quantity: 10,
      materialRatePerGram: 15,
      designRequested: true,
      settings,
    });
    expect(estimate.materialCost).toBe(15000);
    expect(estimate.designCost).toBe(2500);
    expect(estimate.discountPercent).toBe(10);
    expect(estimate.discountAmount).toBe(1500);
    expect(estimate.total).toBe(15000 - 1500 + 2500);
  });

  it("uses the highest matching bulk tier", () => {
    const estimate = estimatePrint({
      weightGrams: 100,
      quantity: 25,
      materialRatePerGram: 10,
      settings: {
        ...settings,
        bulkTiers: [
          { minQty: 10, discountPercent: 5 },
          { minQty: 25, discountPercent: 12 },
        ],
      },
    });
    expect(estimate.discountPercent).toBe(12);
  });

  it("rounds to whole rupees", () => {
    const estimate = estimatePrint({
      weightGrams: 33.3,
      quantity: 1,
      materialRatePerGram: 15.5,
      settings,
    });
    expect(Number.isInteger(estimate.total)).toBe(true);
    expect(estimate.materialCost).toBe(516);
  });
});

const promotion = (overrides: Partial<PrintPromotion>): PrintPromotion => ({
  id: "p1",
  title: "Launch offer",
  body: "",
  image: "",
  ctaLabel: "",
  ctaHref: "",
  discountType: "none",
  discountValue: 0,
  startsAt: null,
  endsAt: null,
  active: true,
  sortOrder: 1,
  ...overrides,
});

describe("activePromotion", () => {
  const now = new Date("2026-11-13T10:00:00Z");

  it("ignores unpublished promotions", () => {
    expect(activePromotion([promotion({ active: false })], now)).toBeNull();
  });

  it("ignores promotions outside their window", () => {
    expect(activePromotion([promotion({ startsAt: "2026-12-01T00:00:00Z" })], now)).toBeNull();
    expect(activePromotion([promotion({ endsAt: "2026-11-01T00:00:00Z" })], now)).toBeNull();
  });

  it("returns the first live promotion by sort order", () => {
    const live = activePromotion(
      [
        promotion({ id: "late", sortOrder: 5 }),
        promotion({ id: "first", sortOrder: 1, startsAt: "2026-11-01T00:00:00Z" }),
      ],
      now
    );
    expect(live?.id).toBe("first");
  });

  it("renders a readable discount badge only when there is a discount", () => {
    expect(promotionBadge(promotion({ discountType: "percent", discountValue: 15 }))).toBe(
      "15% off"
    );
    expect(promotionBadge(promotion({ discountType: "flat", discountValue: 500 }))).toBe(
      "NPR 500 off"
    );
    expect(promotionBadge(promotion({}))).toBe("");
  });
});

describe("quote validation", () => {
  const valid = {
    name: "Asha",
    email: "asha@example.com",
    description: "A replacement knob for a pressure cooker lid.",
    quantity: 2,
  };

  it("accepts a complete request and trims the fields", () => {
    const result = validateQuoteDraft({ ...valid, name: "  Asha  ", phone: " 9800000000 " });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.name).toBe("Asha");
      expect(result.value.phone).toBe("9800000000");
      expect(result.value.quantity).toBe(2);
      expect(result.value.referenceUrls).toEqual([]);
    }
  });

  it("rejects a missing or malformed email", () => {
    expect(validateQuoteDraft({ ...valid, email: "nope" }).ok).toBe(false);
    expect(validateQuoteDraft({ ...valid, email: "" }).ok).toBe(false);
  });

  it("rejects a too-short description", () => {
    expect(validateQuoteDraft({ ...valid, description: "part" }).ok).toBe(false);
  });

  it("clamps quantity to a sane range", () => {
    expect(validateQuoteDraft({ ...valid, quantity: 0 }).ok).toBe(false);
    expect(validateQuoteDraft({ ...valid, quantity: 10_001 }).ok).toBe(false);
    const result = validateQuoteDraft({ ...valid, quantity: "3" });
    expect(result.ok && result.value.quantity).toBe(3);
  });

  it("keeps only http(s) reference links", () => {
    const result = validateQuoteDraft({
      ...valid,
      referenceUrls: "https://example.com/a\njavascript:alert(1)\nnot-a-url\nhttp://ok.test/b",
    });
    expect(result.ok && result.value.referenceUrls).toEqual([
      "https://example.com/a",
      "http://ok.test/b",
    ]);
  });
});

describe("quote files", () => {
  it("accepts CAD, archive and image extensions", () => {
    expect(quoteFileExtension("part.STL")).toBe("stl");
    expect(quoteFileExtension("bracket.3mf")).toBe("3mf");
    expect(quoteFileExtension("model.step")).toBe("step");
    expect(quoteFileExtension("scan.jpg")).toBe("jpg");
  });

  it("rejects executables and unknown types", () => {
    expect(quoteFileExtension("setup.exe")).toBeNull();
    expect(quoteFileExtension("script.js")).toBeNull();
    expect(quoteFileExtension("noextension")).toBeNull();
  });

  it("builds a storage-safe name that keeps the extension", () => {
    const name = quoteStorageName("My Bracket (v2)!!.stl");
    expect(name).toMatch(/\.stl$/);
    expect(name).not.toMatch(/[\s()!]/);
    expect(quoteStorageName("../../etc/passwd")).toMatch(/\.bin$/);
  });

  it("caps attached files at a small number", () => {
    expect(MAX_QUOTE_FILES).toBe(3);
  });
});
