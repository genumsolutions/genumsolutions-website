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

// U-37 (2026-09-25): 12→6 tabs, group names removed.
// Order mirrors the app's AdminScreen exactly (guide/ARCHITECTURE.md B-6).
// Merged: Dashboard+Activity · Orders+Finance · Products+Projects ·
// Services+Journal+Content · Users+Messages+Robots · Settings.
// U-44 (2026-09-26): Catalog split into three catalog tabs mirroring the
// customer storefront — Electronic Products (/products), 3D Products
// (/3d-printing), Projects (/projects).
// U-R3 (2026-10-12): "System Logs" added — fleet crash reports + app logs.
// U-R4 (2026-11-09): "User Logs" + "Profile Entries" added — server-rendered
// panels backed by /api/admin/user-logs and /api/admin/profile-entries and by
// the user_activity_log / user_profile_entries / profile_entry_types tables.
const ADMIN_TABS = [
  "Dashboard",
  "Orders",
  "Electronic Products",
  "3D Products",
  "Projects",
  "Content",
  "Users",
  "System Logs",
  "User Logs",
  "Profile Entries",
  "Settings",
];

// Tabs that exist ONLY on the website. They are web-admin features (paginated
// server routes + service-role reads) with no app-side screen yet, so the app
// is not expected to declare them. Everything outside this list must stay an
// exact match, in the same order, on both clients.
const WEBSITE_ONLY_TABS = ["User Logs", "Profile Entries"];

const SHARED_TABS = ADMIN_TABS.filter((tab) => !WEBSITE_ONLY_TABS.includes(tab));

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
  it("declares the canonical website tabs in admin-types.ts", () => {
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
    // The app mirrors the shared tabs; the website-only panels above are not
    // expected there until the app ships equivalent screens.
    expect(appTabs).toEqual(SHARED_TABS);
  });
});
