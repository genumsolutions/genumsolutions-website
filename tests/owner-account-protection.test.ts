import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// The owner asked (2026-11-12) that the owner account never be deletable. The
// admin UI already hides the button; these guards are the server-side half and
// must exist in BOTH paths (website route + the app's edge function).
const websiteRoute = readFileSync(resolve(__dirname, "../app/api/admin/users/route.ts"), "utf8");
const edgeFunction = readFileSync(
  resolve(__dirname, "../supabase/functions/admin-delete-user/index.ts"),
  "utf8"
);

describe("owner account protection", () => {
  it("website DELETE refuses to delete the caller's own account", () => {
    expect(websiteRoute).toContain("if (current?.id === userId)");
    expect(websiteRoute).toContain("You cannot delete your own account.");
  });

  it("website DELETE refuses the owner target by email or role", () => {
    expect(websiteRoute).toContain("isOwnerEmail(target?.user?.email)");
    expect(websiteRoute).toContain('targetProfile?.role === "owner"');
    expect(websiteRoute).toContain("The owner account cannot be deleted.");
  });

  it("admin-delete-user edge function refuses the owner target by email or role", () => {
    expect(edgeFunction).toContain('const OWNER_EMAIL = "genumsolutions@gmail.com"');
    expect(edgeFunction).toContain('targetProfile?.role === "owner"');
    expect(edgeFunction).toContain("targetEmail === OWNER_EMAIL");
    expect(edgeFunction).toContain("The owner account cannot be deleted.");
  });

  it("admin-delete-user still refuses self-deletion", () => {
    expect(edgeFunction).toContain("if (userId === callerId)");
    expect(edgeFunction).toContain("You cannot delete your own account.");
  });
});
