import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { normalizeItems } from "../lib/orders";

// =====================================================================
// orders.items contract guard (website side).
//
// Both surfaces write the same JSON column, so a field-name change on one
// side silently breaks the other (that is exactly how app orders rendered
// as "NPR NaN" here: the app wrote priceNpr while this client read price).
// The canonical shape lives in supabase/order-items.contract.json; the app
// ships a verbatim copy and both CI pipelines diff the two files.
// =====================================================================

type Contract = {
  table: string;
  column: string;
  requiredKeys: string[];
  priceField: string;
  legacyReadOnlyPriceFields: string[];
};

const contract: Contract = JSON.parse(
  readFileSync(resolve(__dirname, "../supabase/order-items.contract.json"), "utf8")
);

const sorted = (keys: string[]) => [...keys].sort();

describe("orders.items contract", () => {
  it("declares the price field we actually read", () => {
    expect(contract.table).toBe("orders");
    expect(contract.column).toBe("items");
    expect(contract.requiredKeys).toContain(contract.priceField);
    expect(contract.requiredKeys).not.toContain("priceNpr");
  });

  it("normalizes a current line to exactly the contract keys", () => {
    const [line] = normalizeItems([{ productId: "p1", name: "Kit", price: 500, quantity: 2 }]);
    expect(Object.keys(line!)).toEqual(expect.arrayContaining(contract.requiredKeys));
    expect(sorted(Object.keys(line!))).toEqual(sorted(contract.requiredKeys));
    expect(line!.price).toBe(500);
  });

  it("upgrades a historic app line from priceNpr to the shared price field", () => {
    const [line] = normalizeItems([{ productId: "p1", name: "Kit", priceNpr: 750, quantity: 1 }]);
    expect(line!.price).toBe(750);
    expect(Object.keys(line!)).not.toContain("priceNpr");
  });

  it("tolerates malformed rows instead of emitting NaN prices", () => {
    const [line] = normalizeItems([{}]);
    expect(line).toEqual({
      productId: "",
      name: "",
      price: 0,
      quantity: 0,
    });
    expect(normalizeItems(null)).toEqual([]);
  });

  it("has no writer that emits a legacy price field", () => {
    // Files on the order write path. Legacy names may be READ (with a
    // fallback) but never written: `priceNpr:` as an object-literal key.
    const writers = [
      "../lib/checkout.ts",
      "../lib/orders.ts",
      "../app/api/orders/route.ts",
      "../app/api/checkout/esewa/route.ts",
      "../app/api/checkout/khalti/route.ts",
      "../app/checkout/page.tsx",
    ];
    for (const file of writers) {
      const source = readFileSync(resolve(__dirname, file), "utf8");
      for (const legacy of contract.legacyReadOnlyPriceFields) {
        expect(
          new RegExp(`\\b${legacy}\\s*:`).test(source),
          `${file} writes ${legacy}; write ${contract.priceField} instead`
        ).toBe(false);
      }
    }
  });

  it("matches the app's copy of the contract when the sibling repo is present", () => {
    const appCopy = resolve(
      __dirname,
      "../../genumsolutions-app/mobile/src/config/order-items.contract.json"
    );
    if (!existsSync(appCopy)) {
      // App repo not checked out next to this one — the CI job diffs the two
      // copies instead.
      return;
    }
    expect(JSON.parse(readFileSync(appCopy, "utf8"))).toEqual(contract);
  });
});
