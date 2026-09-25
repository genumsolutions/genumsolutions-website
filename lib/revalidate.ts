// On-demand revalidation for admin mutations.
//
// Public pages currently render dynamically (force-dynamic + unstable_noStore),
// so these calls are inert today. They exist so admin edits stay INSTANT the
// moment public routes move to ISR, instead of waiting out a 5-minute revalidate
// window. Verified dependency map (see TRACKS/INDEX.md U-32):
//
//   products            -> / , /products , /products/[slug] , /3d-printing , /projects
//   services            -> /services
//   site_content        -> /
//   programs/pilots/cur -> / , /services
//   journal_posts       -> /journal
//   company_info        -> root layout (every page, incl. metadata)
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

export function revalidateServices(): void {
  safe("/services");
}

export function revalidatePrograms(): void {
  safe("/", "/services");
}

export function revalidateHomeContent(): void {
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
