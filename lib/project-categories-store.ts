// =====================================================================
// project-categories-store.ts — project_categories from Supabase,
// bundled fallback when the DB is unreachable.
//
// U-36 (2026-09-25): the app already reads this table DB-first with a
// bundled fallback (mobile/src/services/projectCategoryService.ts).
// The website now mirrors that pattern so both repos agree on the
// canonical category list: Robo Car · Remote Controller · Smart Dustbin
// · Home Automation · Smart Farm · Smart City · Drones & Aerial.
// =====================================================================
import {
  PROJECT_CATEGORIES,
  getProjectCategory,
  categoryBullets,
  CAPABILITY_NOTES,
} from "./project-catalog";
import { createServiceClient, supabaseConfigured } from "./supabase/server";

export type { ProjectCategory } from "./project-catalog";
export { getProjectCategory, categoryBullets, CAPABILITY_NOTES };

/** The 7 canonical project categories the owner decided on. */
export const PROJECT_CATEGORY_IDS = [
  "robocar",
  "remote-controller",
  "smart-dustbin",
  "home-automation",
  "smart-farm",
  "smart-city",
  "drones",
] as const;

export type ProjectCategoryRow = {
  id: string;
  name: string;
  icon: string;
  car_type: string | null;
  hardware: unknown;
  capabilities: string[];
  capability_labels: Record<string, string>;
  capability_notes: Record<string, string>;
  car_mode_ids: string[];
  sort_order: number;
};

/** Returns every project category, DB-first with a bundled fallback. */
export async function getProjectCategories(): Promise<ProjectCategoryRow[]> {
  if (!supabaseConfigured()) return toRows(PROJECT_CATEGORIES);
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("project_categories")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) throw error;
    if (data && data.length > 0) return data as ProjectCategoryRow[];
  } catch {
    // Fall through to bundled fallback.
  }
  return toRows(PROJECT_CATEGORIES);
}

/** Return a single category by slug, DB-first with fallback. */
export async function getProjectCategoryBySlug(
  slug: string
): Promise<ProjectCategoryRow | undefined> {
  const all = await getProjectCategories();
  return all.find((c) => c.id === slug);
}

/** Which of the canonical category ids are currently empty of products. */
export type CategoryDemand = { id: string; name: string; comingSoon: boolean };

function toRows(cats: typeof PROJECT_CATEGORIES): ProjectCategoryRow[] {
  return cats.map((c) => ({
    id: c.slug,
    name: c.name,
    icon: "",
    car_type: c.carType ?? null,
    hardware: [],
    capabilities: c.capabilities,
    capability_labels: {},
    capability_notes: {},
    car_mode_ids: [],
    sort_order: 0,
  }));
}
