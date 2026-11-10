// =====================================================================
// catalog-extras freshness guard.
//
// `lib/catalog-extras-data.ts` is a SNAPSHOT of database rows that exist
// nowhere else in the repo (2 3D models + 5 project packages, created through
// the admin panel and MakerWorld link-import). A snapshot can be wrong in a
// way hand-maintained data cannot: it can be OLDER than the rows it claims to
// contain, so the offline fallback quietly serves last month's names, prices
// and descriptions while the live site serves the current ones.
//
// The snapshot now records `generatedAt` and each row's `updated_at`, which is
// what makes that checkable without a database. Regenerate with
// `npm run snapshot:catalog-extras` (needs .env.local); the scheduled
// `.github/workflows/snapshot-catalog-extras.yml` opens a PR when it drifts.
// =====================================================================
import { describe, expect, it } from "vitest";

import { catalogExtrasMeta, catalogModels, catalogPackages } from "../lib/catalog-extras-data";
import { localProducts } from "../lib/catalog-data";

const RETAIL = 55;
const extras = [...catalogModels, ...catalogPackages];
const ids = extras.map((p) => p.id);

const parse = (stamp: string | null) => (stamp ? Date.parse(stamp) : NaN);

describe("catalog-extras snapshot", () => {
  it("is not older than the newest row it contains", () => {
    const generatedAt = parse(catalogExtrasMeta.generatedAt);
    expect(
      Number.isNaN(generatedAt),
      `generatedAt is not a date: ${catalogExtrasMeta.generatedAt}`
    ).toBe(false);

    for (const [id, updatedAt] of Object.entries(catalogExtrasMeta.sourceUpdatedAt)) {
      const at = parse(updatedAt);
      expect(Number.isNaN(at), `${id} has an unparsable updated_at`).toBe(false);
      expect(
        at,
        `${id} was edited at ${updatedAt}, AFTER this snapshot was generated at ${catalogExtrasMeta.generatedAt} — regenerate it`
      ).toBeLessThanOrEqual(generatedAt);
    }
  });

  it("records provenance for exactly the rows it contains", () => {
    expect(Object.keys(catalogExtrasMeta.sourceUpdatedAt).sort()).toEqual([...ids].sort());
    // A row edited in the DB but missing from the snapshot shows up here as a
    // count mismatch, because the script counts what it wrote.
    expect(catalogExtrasMeta.counts).toEqual({
      models: catalogModels.length,
      packages: catalogPackages.length,
    });
  });

  it("agrees with the newest source timestamp it advertises", () => {
    const times = Object.values(catalogExtrasMeta.sourceUpdatedAt)
      .map(parse)
      .filter((n) => !Number.isNaN(n));
    expect(times.length).toBe(ids.length);

    const newest = new Date(Math.max(...times)).toISOString();
    expect(
      Math.abs(parse(catalogExtrasMeta.newestSourceUpdatedAt) - Date.parse(newest)),
      `newestSourceUpdatedAt (${catalogExtrasMeta.newestSourceUpdatedAt}) should be the newest row timestamp (${newest})`
    ).toBeLessThanOrEqual(1);
  });

  it("is folded into the offline catalog exactly once", () => {
    expect(extras.length).toBe(Object.keys(catalogExtrasMeta.sourceUpdatedAt).length);
    expect(new Set(ids).size, "duplicate id in the snapshot").toBe(ids.length);

    for (const product of extras) {
      const hits = localProducts.filter((p) => p.id === product.id);
      expect(hits.length, `${product.id} should appear once in localProducts`).toBe(1);
    }

    // The fallback is the retail catalog plus the snapshot — the number the
    // About page renders offline must match live.
    expect(localProducts.length).toBe(RETAIL + extras.length);
    expect(catalogModels).toHaveLength(2);
    expect(catalogPackages).toHaveLength(5);
  });

  it("keeps the fields the clients render", () => {
    for (const product of extras) {
      expect(product.name.trim(), `${product.id} has no name`).not.toBe("");
      expect(product.priceLabel, `${product.id} has no price label`).toBeTruthy();
      expect(product.category, `${product.id} has no category`).toBeTruthy();
    }
  });
});
