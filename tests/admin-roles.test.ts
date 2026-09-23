import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  configured: true,
  role: "staff" as string | null,
  hasUser: true,
}));

vi.mock("../lib/supabase/server", () => ({
  supabaseConfigured: () => state.configured,
  createClient: () => ({
    auth: {
      getUser: async () => ({
        data: { user: state.hasUser ? { id: "u1", email: "staff@genum.test" } : null },
      }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { role: state.role } }),
        }),
      }),
    }),
  }),
}));

import {
  getCurrentAdmin,
  getCurrentUserRole,
  isAdminRequest,
  isOwnerRequest,
  isStaffRequest,
} from "../lib/admin";
import {
  isAdminRole,
  isOwnerRole,
  isStaffRole,
  isValidAdminRole,
  roleAtLeast,
  roleRank,
} from "../lib/roles";

describe("roleRank ladder", () => {
  it("orders customer < staff < admin < owner", () => {
    expect(roleRank("customer")).toBeLessThan(roleRank("staff"));
    expect(roleRank("staff")).toBeLessThan(roleRank("admin"));
    expect(roleRank("admin")).toBeLessThan(roleRank("owner"));
  });

  it("ranks unknown / nil roles as customer (never above)", () => {
    expect(roleRank(undefined)).toBe(0);
    expect(roleRank(null)).toBe(0);
    expect(roleRank("")).toBe(0);
    expect(roleRank("superuser")).toBe(0);
    expect(roleRank(42)).toBe(0);
    expect(roleRank("banana")).toBe(roleRank("customer"));
  });
});

describe("role gates (staff +, admin +, owner = exact)", () => {
  it("isStaffRole covers staff/admin/owner only", () => {
    expect(isStaffRole("staff")).toBe(true);
    expect(isStaffRole("admin")).toBe(true);
    expect(isStaffRole("owner")).toBe(true);
    expect(isStaffRole("customer")).toBe(false);
    expect(isStaffRole(null)).toBe(false);
  });

  it("isAdminRole covers admin/owner only", () => {
    expect(isAdminRole("owner")).toBe(true);
    expect(isAdminRole("admin")).toBe(true);
    expect(isAdminRole("staff")).toBe(false);
    expect(isAdminRole("customer")).toBe(false);
  });

  it("isOwnerRole is owner exactly (owner is a role, not an id)", () => {
    expect(isOwnerRole("owner")).toBe(true);
    expect(isOwnerRole("admin")).toBe(false);
    expect(isOwnerRole("staff")).toBe(false);
  });

  it("roleAtLeast respects the ladder thresholds", () => {
    expect(roleAtLeast("staff", "staff")).toBe(true);
    expect(roleAtLeast("admin", "staff")).toBe(true);
    expect(roleAtLeast("customer", "staff")).toBe(false);
    expect(roleAtLeast("staff", "admin")).toBe(false);
    expect(roleAtLeast(undefined, "staff")).toBe(false);
  });

  it("isValidAdminRole narrows only the three admin roles", () => {
    expect(isValidAdminRole("staff")).toBe(true);
    expect(isValidAdminRole("admin")).toBe(true);
    expect(isValidAdminRole("owner")).toBe(true);
    expect(isValidAdminRole("customer")).toBe(false);
    expect(isValidAdminRole("")).toBe(false);
  });
});

describe("lib/admin request gates (mock supabase)", () => {
  beforeEach(() => {
    state.configured = true;
    state.role = "staff";
    state.hasUser = true;
  });

  it("unconfigured returns false/null everywhere", async () => {
    state.configured = false;
    expect(await isStaffRequest()).toBe(false);
    expect(await isAdminRequest()).toBe(false);
    expect(await isOwnerRequest()).toBe(false);
    expect(await getCurrentUserRole()).toBeNull();
    expect(await getCurrentAdmin()).toBeNull();
  });

  it("staff passes the staff gate only", async () => {
    state.role = "staff";
    expect(await isStaffRequest()).toBe(true);
    expect(await isAdminRequest()).toBe(false);
    expect(await isOwnerRequest()).toBe(false);
    expect(await getCurrentUserRole()).toBe("staff");
    expect(await getCurrentAdmin()).toEqual({ id: "u1", email: "staff@genum.test" });
  });

  it("admin passes staff+admin but not owner", async () => {
    state.role = "admin";
    expect(await isStaffRequest()).toBe(true);
    expect(await isAdminRequest()).toBe(true);
    expect(await isOwnerRequest()).toBe(false);
    expect(await getCurrentUserRole()).toBe("admin");
  });

  it("owner passes every gate", async () => {
    state.role = "owner";
    expect(await isStaffRequest()).toBe(true);
    expect(await isAdminRequest()).toBe(true);
    expect(await isOwnerRequest()).toBe(true);
    expect(await getCurrentUserRole()).toBe("owner");
  });

  it("customer and unknown roles fail every admin gate", async () => {
    for (const role of ["customer", "banned", null]) {
      state.role = role;
      expect(await isStaffRequest(), `staff gate for ${role}`).toBe(false);
      expect(await isAdminRequest(), `admin gate for ${role}`).toBe(false);
      expect(await isOwnerRequest(), `owner gate for ${role}`).toBe(false);
      expect(await getCurrentUserRole(), `role string for ${role}`).toBeNull();
      expect(await getCurrentAdmin(), `admin identity for ${role}`).toBeNull();
    }
  });

  it("no signed-in user fails every gate", async () => {
    state.hasUser = false;
    expect(await isStaffRequest()).toBe(false);
    expect(await isAdminRequest()).toBe(false);
    expect(await isOwnerRequest()).toBe(false);
  });
});
