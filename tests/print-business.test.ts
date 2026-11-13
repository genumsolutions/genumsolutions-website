import { describe, expect, it } from "vitest";
import {
  costPrintJob,
  costingStatus,
  defaultPrintCosting,
  grossMargin,
  quoteMargin,
  suggestedPrice,
  type PrintCosting,
} from "../lib/print-costing";
import {
  defaultPrintSettings,
  publishedPrintSettings,
  publishedRate,
  type PrintMaterial,
} from "../lib/print";

// Fixtures follow the owner's handoff (13 Nov 2026) so the maths can be
// checked against its worked examples rather than against itself.
const completeCosting: PrintCosting = {
  ...defaultPrintCosting,
  filamentCostPerGram: 2,
  wastagePercent: 10,
  electricityRatePerKwh: 9.21,
  printerWatts: 150,
  machineCost: 50000,
  machineLifeHours: 5000,
  maintenancePerHour: 2,
  labourPerHour: 300,
  packagingPerJob: 30,
  paymentFeePercent: 0,
  overheadPerMonth: 20000,
  monthlyOrderTarget: 40,
  targetMarginPercent: 60,
};

describe("costPrintJob", () => {
  it("bills 100 g with the 10% allowance as 110 g and NPR 220 of PLA", () => {
    const job = costPrintJob(completeCosting, { grams: 100, printHours: 2 });
    expect(job.gramsBilled).toBe(110);
    expect(job.materialCost).toBe(220);
  });

  it("adds electricity, machine, maintenance, labour and packaging", () => {
    const job = costPrintJob(completeCosting, {
      grams: 100,
      printHours: 2,
      labourHours: 0.25,
    });
    // 0.15 kW × 2 h × 9.21
    expect(job.electricityCost).toBe(2.76);
    // 50,000 ÷ 5,000 h × 2 h
    expect(job.machineCost).toBe(20);
    expect(job.maintenanceCost).toBe(4);
    expect(job.labourCost).toBe(75);
    expect(job.packagingCost).toBe(30);
    // Overhead is spread over the monthly order target: 20,000 ÷ 40.
    expect(job.overheadAllocation).toBe(500);
    expect(job.total).toBe(851.76);
    expect(job.complete).toBe(true);
  });

  it("stays incomplete (and says what is missing) on an empty sheet", () => {
    const job = costPrintJob(defaultPrintCosting, { grams: 100, printHours: 2 });
    expect(job.complete).toBe(false);
    expect(job.missing).toContain("filament cost per gram");
    expect(job.total).toBe(0);
  });

  it("never returns a negative cost for negative input", () => {
    const job = costPrintJob(completeCosting, { grams: -50, printHours: -2 });
    expect(job.total).toBeGreaterThanOrEqual(0);
  });
});

describe("suggestedPrice / grossMargin", () => {
  it("matches the handoff example: NPR 400 cost at 60% → NPR 1,000", () => {
    expect(suggestedPrice(400, 60)).toBe(1000);
  });

  it("rounds the price up to the next 5 rupees", () => {
    expect(suggestedPrice(851.76, 60)).toBe(2130);
    expect(suggestedPrice(0, 60)).toBe(0);
  });

  it("reports the margin of a price over a cost", () => {
    expect(grossMargin(1000, 400)).toBe(60);
    expect(grossMargin(0, 400)).toBe(0);
  });
});

describe("quoteMargin", () => {
  it("is null until a quote has a price", () => {
    expect(
      quoteMargin(completeCosting, {
        quotedAmount: 0,
        estimatedGrams: 100,
        printHours: 2,
      })
    ).toBeNull();
  });

  it("is null while the costing sheet is incomplete — no guessed profit", () => {
    expect(
      quoteMargin(defaultPrintCosting, {
        quotedAmount: 1500,
        estimatedGrams: 100,
        printHours: 2,
      })
    ).toBeNull();
  });

  it("doubles the cost of a reprinted job", () => {
    // A quote record has no labour figure, so the margin uses material, machine,
    // electricity, maintenance, packaging and overhead only (NPR 776.76).
    const quote = { quotedAmount: 1500, estimatedGrams: 100, printHours: 2 };
    const once = quoteMargin(completeCosting, quote);
    const twice = quoteMargin(completeCosting, { ...quote, reprint: true });
    expect(once?.cost).toBe(776.76);
    expect(twice?.cost).toBe(1553.52);
    expect(twice!.marginPercent).toBeLessThan(once!.marginPercent);
  });
});

describe("costingStatus", () => {
  it("lists each missing input once", () => {
    const status = costingStatus({ ...defaultPrintCosting, filamentCostPerGram: 2 });
    expect(status.complete).toBe(false);
    expect(status.missing).not.toContain("filament cost per gram");
    expect(status.missing).toContain("labour rate");
  });
});

describe("publication gating", () => {
  const pla: PrintMaterial = {
    id: "pla",
    name: "PLA",
    description: "",
    ratePerGram: 12,
    note: "",
    sortOrder: 1,
    active: true,
  };

  it("hides rates and the calculator while pricing is draft", () => {
    const settings = { ...defaultPrintSettings, calculatorEnabled: true };
    expect(publishedPrintSettings(settings).calculatorEnabled).toBe(false);
    expect(publishedRate(pla, settings)).toBe(0);
  });

  it("publishes the rate once an admin approved pricing", () => {
    const settings = {
      ...defaultPrintSettings,
      calculatorEnabled: true,
      pricingStatus: "approved" as const,
    };
    expect(publishedPrintSettings(settings).calculatorEnabled).toBe(true);
    expect(publishedRate(pla, settings)).toBe(12);
  });
});
