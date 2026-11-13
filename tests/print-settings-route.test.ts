import { beforeEach, describe, expect, it, vi } from "vitest";

// Regression cover for the 3D print admin route: a settings save must merge
// the stored row (not rebuild it from the request) and must never change the
// approval state, which belongs to the dedicated `pricing` action.
const state = vi.hoisted(() => ({
  staff: true,
  admin: true,
  sessionEmail: "owner@example.com",
  stored: null as Record<string, unknown> | null,
  savedSettings: [] as Record<string, unknown>[],
  approvals: [] as Record<string, unknown>[],
  revalidated: 0,
}));

vi.mock("../lib/admin", () => ({
  isStaffRequest: async () => state.staff,
  isAdminRequest: async () => state.admin,
}));

vi.mock("../lib/activity", () => ({ logActivity: async () => undefined }));

vi.mock("../lib/revalidate", () => ({
  revalidatePrint: () => {
    state.revalidated += 1;
  },
}));

vi.mock("../lib/supabase/server", () => ({
  getSessionUser: async () => ({ email: state.sessionEmail }),
}));

vi.mock("../lib/print-store", () => {
  const noop = async () => undefined;
  return {
    getPrintContent: async () => ({}),
    getPrintCosting: async () => null,
    getPrintQuoteRequests: async () => [],
    getPrintSettings: async () => state.stored,
    signedQuoteFiles: async () => [],
    savePrintSettings: async (settings: Record<string, unknown>) => {
      state.savedSettings.push(settings);
    },
    setPrintPricingApproval: async (values: Record<string, unknown>) => {
      state.approvals.push(values);
    },
    savePrintCategory: noop,
    savePrintGalleryItem: noop,
    savePrintMaterial: noop,
    savePrintPromotion: noop,
    savePrintCosting: noop,
    savePrintService: noop,
    deletePrintCategory: noop,
    deletePrintGalleryItem: noop,
    deletePrintMaterial: noop,
    deletePrintPromotion: noop,
    deletePrintQuote: noop,
    deletePrintService: noop,
    updatePrintQuote: noop,
  };
});

import { PUT } from "../app/api/admin/print/route";
import { defaultPrintSettings, type PrintSettings } from "../lib/print";

const put = (resource: string, item: Record<string, unknown>) =>
  PUT(
    new Request("http://localhost/api/admin/print", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ resource, item }),
    })
  );

const storedSettings = (overrides: Partial<PrintSettings> = {}): PrintSettings => ({
  ...defaultPrintSettings,
  calculatorEnabled: true,
  minimumOrder: 350,
  designBaseCharge: 2500,
  finishingCharges: [{ id: "sanded", name: "Sanded", amount: 200 }],
  bulkTiers: [{ minQty: 10, discountPercent: 5 }],
  disclaimer: "Indicative only.",
  heroImage: "/hero.jpg",
  materialsIntro: "PLA and PETG.",
  pricingStatus: "approved",
  pricingApprovedAt: "2026-11-13T17:35:03.869Z",
  pricingApprovedBy: "genumsolutions@gmail.com",
  ...overrides,
});

const lastSaved = (): Record<string, unknown> => {
  const saved = state.savedSettings[0];
  if (!saved) throw new Error("expected the route to save settings");
  return saved;
};

beforeEach(() => {
  state.staff = true;
  state.admin = true;
  state.sessionEmail = "owner@example.com";
  state.stored = storedSettings() as unknown as Record<string, unknown>;
  state.savedSettings.length = 0;
  state.approvals.length = 0;
  state.revalidated = 0;
});

describe("print settings PUT", () => {
  it("rejects non-staff callers before reading the body", async () => {
    state.staff = false;
    const response = await put("settings", { calculatorEnabled: false });
    expect(response.status).toBe(401);
    expect(state.savedSettings).toHaveLength(0);
  });

  it("keeps every field a partial save does not send", async () => {
    const response = await put("settings", { calculatorEnabled: false });
    expect(response.status).toBe(200);

    const saved = lastSaved();
    expect(saved.calculatorEnabled).toBe(false);
    expect(saved.minimumOrder).toBe(350);
    expect(saved.designBaseCharge).toBe(2500);
    expect(saved.finishingCharges).toEqual([{ id: "sanded", name: "Sanded", amount: 200 }]);
    expect(saved.bulkTiers).toEqual([{ minQty: 10, discountPercent: 5 }]);
    expect(saved.disclaimer).toBe("Indicative only.");
    expect(saved.heroImage).toBe("/hero.jpg");
    expect(saved.materialsIntro).toBe("PLA and PETG.");
  });

  it("clears a string field only when null is sent explicitly", async () => {
    await put("settings", { heroImage: null, disclaimer: "" });
    const saved = lastSaved();
    expect(saved.heroImage).toBe("");
    expect(saved.disclaimer).toBe("");
    // Untouched strings still survive.
    expect(saved.materialsIntro).toBe("PLA and PETG.");
  });

  it("never lets a settings save change the approval state", async () => {
    await put("settings", {
      calculatorEnabled: false,
      pricingStatus: "draft",
      pricingApprovedBy: "someone@example.com",
      pricingApprovedAt: "2020-01-01T00:00:00Z",
    });
    const saved = lastSaved();
    expect(saved.pricingStatus).toBe("approved");
    expect(saved.pricingApprovedBy).toBe("genumsolutions@gmail.com");
    expect(saved.pricingApprovedAt).toBe("2026-11-13T17:35:03.869Z");
  });

  it("replaces the lists when they are sent, clamped and capped", async () => {
    await put("settings", {
      finishingCharges: [
        { id: "paint", name: "Painted", amount: -50 },
        { id: "", name: "", amount: 100 },
        ...Array.from({ length: 24 }, (_, i) => ({ id: `f${i}`, name: `Finish ${i}`, amount: 10 })),
      ],
      bulkTiers: [
        { minQty: 0, discountPercent: 250 },
        ...Array.from({ length: 14 }, () => ({ minQty: 5, discountPercent: 5 })),
      ],
    });
    const saved = lastSaved();
    const charges = saved.finishingCharges as { name: string; amount: number }[];
    const tiers = saved.bulkTiers as { minQty: number; discountPercent: number }[];
    expect(charges).toHaveLength(20);
    expect(charges.every((charge) => charge.name.length > 0)).toBe(true);
    expect(charges[0]?.amount).toBe(0); // negative clamped
    expect(tiers).toHaveLength(10);
    expect(tiers[0]).toEqual({ minQty: 1, discountPercent: 90 }); // clamped
  });

  it("clamps numeric fields and never goes negative", async () => {
    await put("settings", { minimumOrder: -100, designBaseCharge: -1 });
    const saved = lastSaved();
    expect(saved.minimumOrder).toBe(0);
    expect(saved.designBaseCharge).toBe(0);
  });

  it("revalidates the 3D print surface after a save", async () => {
    await put("settings", { calculatorEnabled: true });
    expect(state.revalidated).toBe(1);
  });
});

describe("print pricing approval action", () => {
  it("is admin-only", async () => {
    state.admin = false;
    const response = await put("pricing", { approved: true });
    expect(response.status).toBe(403);
    expect(state.approvals).toHaveLength(0);
  });

  it("publishes with the approver's email", async () => {
    const response = await put("pricing", { approved: true });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, pricingStatus: "approved" });
    expect(state.approvals[0]).toEqual({
      approved: true,
      approvedBy: "owner@example.com",
    });
    expect(state.savedSettings).toHaveLength(0);
  });

  it("withdraws and clears the approver", async () => {
    await put("pricing", { approved: false });
    expect(state.approvals[0]).toEqual({ approved: false, approvedBy: "" });
  });

  it("does not publish on a truthy-but-not-true value", async () => {
    await put("pricing", { approved: "yes" });
    expect(state.approvals[0]).toEqual({ approved: false, approvedBy: "" });
  });
});
