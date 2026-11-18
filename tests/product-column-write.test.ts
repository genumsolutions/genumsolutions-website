// tests/product-column-write.test.ts — the write half of the 2026-11-18
// project-details columns rollout (website).
//
// saveProduct() dual-writes: import_meta.projectDetails always, and the
// project_* columns only after a one-time probe confirms they exist. Naming a
// column the database does not have fails the entire product save with 42703,
// so the gate is the thing worth testing here.
import { beforeEach, describe, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => {
  const calls: { method: string; args: unknown[] }[] = [];
  let probe: { data: unknown; error: unknown } = { data: null, error: null };

  const builder = {
    select: (...args: unknown[]) => {
      calls.push({ method: "select", args });
      return builder;
    },
    limit: (...args: unknown[]) => {
      calls.push({ method: "limit", args });
      return Promise.resolve(probe);
    },
    upsert: (...args: unknown[]) => {
      calls.push({ method: "upsert", args });
      return Promise.resolve({ data: null, error: null });
    },
  };

  return {
    calls,
    client: { from: () => builder },
    setProbe(next: { data: unknown; error: unknown }) {
      probe = next;
    },
    reset() {
      calls.length = 0;
      probe = { data: null, error: null };
    },
  };
});

vi.mock("../lib/supabase/server", () => ({
  createServiceClient: () => fake.client,
  supabaseConfigured: () => true,
}));

import { blankProjectDetails } from "../lib/project-details";
import { resetProjectDetailColumnsProbe, saveProduct, type Product } from "../lib/content-store";

beforeEach(() => {
  fake.reset();
  resetProjectDetailColumnsProbe();
});

const product = (): Product => ({
  id: "line-follower",
  name: "Line follower",
  category: "Project Packages",
  price: 2500,
  priceLabel: "NPR 2,500",
  sku: "",
  productType: "Project package",
  note: "",
  description: "",
  specs: [],
  audience: "School",
  difficulty: "Beginner",
  warranty: "",
  stock: 0,
  delivery: "",
  color: "from-[#dce8ff] to-[#7e9ff2]",
  importMeta: {
    projectDetails: {
      ...blankProjectDetails(),
      code: { ...blankProjectDetails().code, language: "Arduino C++" },
    },
  },
});

const savedRow = () => {
  const upsert = fake.calls.find((call) => call.method === "upsert");
  return (upsert?.args[0] ?? {}) as Record<string, unknown>;
};

describe("saveProduct project-detail columns", () => {
  it("saves without the columns when the probe reports they are missing", async () => {
    fake.setProbe({ data: null, error: { message: "column does not exist" } });

    await saveProduct(product());

    const row = savedRow();
    expect(row.project_code_language).toBeUndefined();
    expect(row.import_meta).toMatchObject({
      projectDetails: { code: { language: "Arduino C++" } },
    });
  });

  it("writes both copies once the probe confirms the columns", async () => {
    fake.setProbe({ data: [{ project_code_language: "Arduino C++" }], error: null });

    await saveProduct(product());

    const row = savedRow();
    expect(row.project_code_language).toBe("Arduino C++");
    expect(row.project_procedure_steps).toEqual([]);
    expect(row.import_meta).toMatchObject({
      projectDetails: { code: { language: "Arduino C++" } },
    });
  });

  it("probes once per server instance", async () => {
    fake.setProbe({ data: [{ project_code_language: "x" }], error: null });

    await saveProduct(product());
    await saveProduct(product());

    expect(fake.calls.filter((call) => call.method === "select")).toHaveLength(1);
    expect(fake.calls.filter((call) => call.method === "upsert")).toHaveLength(2);
  });
});
