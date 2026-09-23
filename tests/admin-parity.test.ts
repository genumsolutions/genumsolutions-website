import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

// =====================================================================
// Admin-surface parity guard (guide/ARCHITECTURE.md B-6): the website
// AdminPanel and the app AdminScreen must expose the SAME tab inventory,
// in the SAME order. Website canonical list: `components/admin/admin-types.ts`
// (TABS). App canonical list: sibling repo `mobile/src/config/adminTabs.ts`.
// Change both + both tests together.
// =====================================================================

const ADMIN_TABS = [
  "Dashboard",
  "Orders",
  "Products",
  "Projects",
  "Services",
  "Journal",
  "Users",
  "Messages",
  "Finance",
  "Activity",
  "Content",
  "Settings",
];

function readAdminTypesSource(): string {
  const local = resolve(__dirname, "../components/admin/admin-types.ts");
  if (existsSync(local)) return readFileSync(local, "utf8");
  // Vercel CI layout — repo root is two levels up from components/admin.
  const sibling = resolve(
    __dirname,
    "../../genumsolutions-website/components/admin/admin-types.ts"
  );
  if (existsSync(sibling)) return readFileSync(sibling, "utf8");
  return "";
}

describe("admin tab inventory (website <-> app mirror, B-6)", () => {
  it("declares the 12 canonical tabs in admin-types.ts", () => {
    const source = readAdminTypesSource();
    expect(source, "admin-types.ts not found").not.toBe("");
    const match = source.match(/export const TABS = \[([^\]]+)\] as const/);
    expect(match, "TABS declaration not found").toBeTruthy();
    // Quote-agnostic strip: prettier (singleQuote:false) may render the
    // literals double-quoted — strip either style (2026-09-23 sweep).
    const tabs = (match![1] ?? "")
      .split(",")
      .map((s) => s.trim().replace(/^["']|["']$/g, ""))
      .filter(Boolean);
    expect(tabs).toEqual(ADMIN_TABS);
  });

  it("matches the app AdminScreen canonical list (read from the sibling repo)", () => {
    const appPath = resolve(
      __dirname,
      "../../../genumsolutions-app/mobile/src/config/adminTabs.ts"
    );
    if (!existsSync(appPath)) {
      // App repo not checked out next to the website — canonical list above
      // is the contract; skip the cross-repo read.
      return;
    }
    const source = readFileSync(appPath, "utf8");
    const match = source.match(/export const ADMIN_TABS = \[([^\]]+)\] as const/);
    expect(match, "ADMIN_TABS declaration not found").toBeTruthy();
    const appTabs = (match![1] ?? "")
      .split(",")
      .map((s) => s.trim().replace(/^["']|["']$/g, ""))
      .filter(Boolean);
    expect(appTabs).toEqual(ADMIN_TABS);
  });
});
