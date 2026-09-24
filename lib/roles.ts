// =====================================================================
// roles.ts - pure, shared RBAC helpers for the accounts system.
//
// Role ladder: customer(0) < staff(1) < admin(2) < owner(3).
// Staff = everything EXCEPT deletions; admin is owner minus owner-only
// account deletion; owner is the `genumsolutions` account (role, not id).
// Pure module - no server or client imports, safe for both sides.
// =====================================================================

export type Role = "customer" | "staff" | "admin" | "owner";
export type AdminRole = "staff" | "admin" | "owner";

export const ROLE_RANK: Record<Role, number> = {
  customer: 0,
  staff: 1,
  admin: 2,
  owner: 3,
};

// Display labels for the account menu badge. Unknown roles fall back to
// "Customer" so a stale value is never blank in the UI.
export const ROLE_LABELS: Record<string, string> = {
  customer: "Customer",
  staff: "Staff",
  admin: "Admin",
  owner: "Owner",
};

// Unknown/nil roles rank as customer (0) — never above.
export function roleRank(role: unknown): number {
  if (typeof role !== "string") return 0;
  return ROLE_RANK[role as Role] ?? 0;
}

export function isValidAdminRole(role: unknown): role is AdminRole {
  return role === "staff" || role === "admin" || role === "owner";
}

export function roleAtLeast(role: unknown, min: AdminRole): boolean {
  return roleRank(role) >= roleRank(min);
}

export function isStaffRole(role: unknown): boolean {
  return roleAtLeast(role, "staff");
}

export function isAdminRole(role: unknown): boolean {
  return roleAtLeast(role, "admin");
}

export function isOwnerRole(role: unknown): boolean {
  return roleAtLeast(role, "owner");
}
