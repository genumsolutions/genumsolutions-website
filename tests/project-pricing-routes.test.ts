import { beforeEach, describe, expect, it, vi } from "vitest";

// The route handlers are thin: they own the role gate, the sanitising and the
// partial-merge contract. The DB layer is mocked so these tests pin the API
// behaviour (what a caller may send, what gets stored, what leaks publicly).
const state = vi.hoisted(() => ({
  staff: true,
  admin: true,
  sessionEmail: "owner@example.com",
  existing: null as Record<string, unknown> | null,
  published: null as Record<string, unknown> | null,
  saved: [] as Record<string, unknown>[],
  approvals: [] as Record<string, unknown>[],
  revalidated: [] as (string | undefined)[],
}));

vi.mock("../lib/admin", () => ({
  isStaffRequest: async () => state.staff,
  isAdminRequest: async () => state.admin,
}));

vi.mock("../lib/activity", () => ({ logActivity: async () => undefined }));

vi.mock("../lib/revalidate", () => ({
  revalidateProjectPricing: (id?: string) => state.revalidated.push(id),
}));

vi.mock("../lib/supabase/server", () => ({
  getSessionUser: async () => ({ email: state.sessionEmail }),
}));

vi.mock("../lib/project-pricing-store", () => ({
  getProjectPricing: async () => state.existing,
  listProjectPricing: async () => (state.existing ? [state.existing] : []),
  saveProjectPricing: async (pricing: Record<string, unknown>) => {
    state.saved.push(pricing);
  },
  setProjectPricingApproval: async (values: Record<string, unknown>) => {
    state.approvals.push(values);
  },
  getPublishedProjectPricing: async () => state.published,
}));

import { GET as adminGET, PUT as adminPUT } from "../app/api/admin/project-pricing/route";
import { GET as publicGET } from "../app/api/project-pricing/[projectId]/route";

const row = (overrides: Record<string, unknown> = {}) => ({
  id: "smart-dustbin",
  packageBaseCharge: 2500,
  componentMarkupPercent: 20,
  extras: [{ id: "training", name: "Training", amount: 1000 }],
  bulkTiers: [{ minQty: 10, discountPercent: 5 }],
  minimumOrder: 5000,
  priceStatus: "draft",
  priceApprovedAt: null,
  priceApprovedBy: "",
  note: "internal only",
  updatedAt: "2026-11-13T00:00:00Z",
  ...overrides,
});

const lastSaved = (): Record<string, unknown> => {
  const saved = state.saved[0];
  if (!saved) throw new Error("expected the route to save a pricing row");
  return saved;
};

const put = (body: Record<string, unknown>) =>
  adminPUT(
    new Request("http://localhost/api/admin/project-pricing", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  );

beforeEach(() => {
  state.staff = true;
  state.admin = true;
  state.sessionEmail = "owner@example.com";
  state.existing = row();
  state.published = null;
  state.saved.length = 0;
  state.approvals.length = 0;
  state.revalidated.length = 0;
});

describe("admin project-pricing GET", () => {
  it("rejects non-staff callers", async () => {
    state.staff = false;
    const response = await adminGET(new Request("http://localhost/api/admin/project-pricing"));
    expect(response.status).toBe(401);
  });

  it("lists every row when no projectId is given", async () => {
    const response = await adminGET(new Request("http://localhost/api/admin/project-pricing"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ pricing: [row()] });
  });

  it("reads one row when projectId is given", async () => {
    const response = await adminGET(
      new Request("http://localhost/api/admin/project-pricing?projectId=smart-dustbin")
    );
    expect(await response.json()).toEqual({ pricing: row() });
  });
});

describe("admin project-pricing PUT: settings", () => {
  it("requires a projectId", async () => {
    const response = await put({ packageBaseCharge: 100 });
    expect(response.status).toBe(400);
  });

  it("keeps every field a partial save does not send", async () => {
    // Only the extras change; base charge, markup, tiers, minimum and note
    // must survive (this used to wipe them).
    const response = await put({
      projectId: "smart-dustbin",
      extras: [{ id: "delivery", name: "Delivery", amount: 300 }],
    });
    expect(response.status).toBe(200);
    expect(state.saved).toHaveLength(1);
    const saved = lastSaved();
    expect(saved.packageBaseCharge).toBe(2500);
    expect(saved.componentMarkupPercent).toBe(20);
    expect(saved.bulkTiers).toEqual([{ minQty: 10, discountPercent: 5 }]);
    expect(saved.minimumOrder).toBe(5000);
    expect(saved.note).toBe("internal only");
    expect(saved.extras).toEqual([{ id: "delivery", name: "Delivery", amount: 300 }]);
  });

  it("never lets a settings save change the approval state", async () => {
    await put({
      projectId: "smart-dustbin",
      packageBaseCharge: 3000,
      priceStatus: "approved",
      priceApprovedBy: "someone@example.com",
    });
    const saved = lastSaved();
    expect(saved.priceStatus).toBe("draft");
    expect(saved.priceApprovedBy).toBe("");
    expect(saved.priceApprovedAt).toBeNull();
  });

  it("clamps out-of-range numbers and rejects non-array lists", async () => {
    await put({
      projectId: "smart-dustbin",
      packageBaseCharge: -500,
      componentMarkupPercent: 9000,
      extras: "nope",
      bulkTiers: "nope",
      minimumOrder: -10,
    });
    const saved = lastSaved();
    expect(saved.packageBaseCharge).toBe(0);
    expect(saved.componentMarkupPercent).toBe(500);
    expect(saved.minimumOrder).toBe(0);
    expect(saved.extras).toEqual([]);
    expect(saved.bulkTiers).toEqual([]);
  });

  it("drops nameless extras and stays within the caps", async () => {
    await put({
      projectId: "smart-dustbin",
      extras: [
        { id: "a", name: "Training", amount: 500 },
        { id: "b", name: "", amount: 900 },
        ...Array.from({ length: 25 }, (_, i) => ({
          id: `x${i}`,
          name: `Extra ${i}`,
          amount: 10,
        })),
      ],
      bulkTiers: Array.from({ length: 15 }, () => ({ minQty: 5, discountPercent: 5 })),
    });
    const saved = lastSaved();
    expect(saved.extras).toHaveLength(20);
    expect((saved.extras as { name: string }[]).every((extra) => extra.name)).toBe(true);
    expect(saved.bulkTiers).toHaveLength(10);
  });
});

describe("admin project-pricing PUT: approval", () => {
  it("is admin-only", async () => {
    state.admin = false;
    const response = await put({
      projectId: "smart-dustbin",
      resource: "pricing",
      approved: true,
    });
    expect(response.status).toBe(403);
    expect(state.approvals).toHaveLength(0);
  });

  it("stamps the approver's email when publishing", async () => {
    const response = await put({
      projectId: "smart-dustbin",
      resource: "pricing",
      approved: true,
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, pricingStatus: "approved" });
    expect(state.approvals[0]).toEqual({
      projectId: "smart-dustbin",
      approved: true,
      approvedBy: "owner@example.com",
    });
    expect(state.revalidated).toEqual(["smart-dustbin"]);
  });

  it("clears the approver when withdrawing", async () => {
    state.existing = row({ priceStatus: "approved" });
    await put({ projectId: "smart-dustbin", resource: "pricing", approved: false });
    expect(state.approvals[0]).toEqual({
      projectId: "smart-dustbin",
      approved: false,
      approvedBy: "",
    });
  });

  it("does not approve on a truthy-but-not-true value", async () => {
    await put({ projectId: "smart-dustbin", resource: "pricing", approved: "yes" });
    expect(state.approvals[0]).toMatchObject({ approved: false });
  });
});

describe("public project-pricing GET", () => {
  const call = (projectId: string) =>
    publicGET(new Request(`http://localhost/api/project-pricing/${projectId}`), {
      params: { projectId },
    });

  it("returns null when nothing is approved", async () => {
    const response = await call("smart-dustbin");
    expect(await response.json()).toEqual({
      projectId: "smart-dustbin",
      pricing: null,
    });
  });

  it("returns only the fields a customer needs", async () => {
    state.published = row({ priceStatus: "approved" });
    const body = await (await call("smart-dustbin")).json();
    expect(Object.keys(body.pricing).sort()).toEqual(
      [
        "bulkTiers",
        "componentMarkupPercent",
        "extras",
        "id",
        "minimumOrder",
        "packageBaseCharge",
        "priceStatus",
      ].sort()
    );
    // The internal note and the approver's email must never leave the server.
    expect(JSON.stringify(body)).not.toContain("internal only");
    expect(JSON.stringify(body)).not.toContain("priceApprovedBy");
  });

  it("rejects an empty project id", async () => {
    const response = await call("");
    expect(response.status).toBe(400);
  });
});
