// On-demand revalidation for admin mutations.
//
// U-48 (2026-09-27): the U-32 ISR flip has now LANDED. These calls are no longer
// inert - public routes are cached (no force-dynamic, no unstable_noStore) and
// these are the calls that keep admin edits instant instead of waiting out the
// 5-minute revalidate window in the root layout. Verified dependency map
// (see TRACKS/INDEX.md U-32):
//
//   products            -> / , /products , /products/[slug] , /3d-printing , /projects
//   services            -> /services
//   site_content        -> /
//   programs/pilots/cur -> / , /services
//   journal_posts       -> /journal
//   company_info        -> root layout (every page, incl. metadata)
//
// project_categories has no web write path (only the app writes that table), so
// it rides the 300 s window rather than an explicit revalidate call.
//
// robo_car_modes is intentionally absent: /tools renders the static
// ROBOCAR_MODES catalog, and only the app reads that table.
import { revalidatePath } from "next/cache";

function safe(...paths: string[]): void {
  for (const path of paths) {
    try {
      revalidatePath(path);
    } catch (error) {
      console.warn(`revalidatePath(${path}) failed:`, error);
    }
  }
}

export function revalidateProducts(productId?: string): void {
  safe("/", "/products", "/3d-printing", "/projects");
  if (productId) safe(`/products/${productId}`);
}

// 3D print studio content (categories, rates/settings, promotions, gallery)
// all renders on /3d-printing; product rows route through revalidateProducts.
export function revalidatePrint(): void {
  // 2026-11-14: "/" as well — the landing page now prints the active
  // print promotion as a dismissible sticker, so a promotion edit in admin has
  // to invalidate the home page too or the sticker lags up to 5 minutes.
  safe("/3d-printing", "/");
}

export function revalidateProjectPricing(projectId?: string): void {
  safe("/projects", "/products");
  if (projectId) safe(`/products/${projectId}`);
}

export function revalidateServices(): void {
  safe("/services");
}

export function revalidatePrograms(): void {
  safe("/", "/services");
}

export function revalidateHomeContent(): void {
  safe("/");
}
export function revalidateContent(): void {
  safe("/");
}

export function revalidateJournal(): void {
  safe("/journal");
}

export function revalidateCompany(): void {
  try {
    revalidatePath("/", "layout");
  } catch (error) {
    console.warn("revalidatePath(/, layout) failed:", error);
  }
}
