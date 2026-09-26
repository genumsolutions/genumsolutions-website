/**
 * Product catalog — shared types and utility functions.
 *
 * The actual product data lives in Supabase (served via getManagedProducts)
 * with a local fallback in `catalog-data.ts` for offline / seed purposes.
 */
import { localProducts } from "./catalog-data";

export type Product = {
  id: string;
  name: string;
  category: string;
  project_category?: string;
  price: number;
  priceLabel: string;
  sku: string;
  productType: "Retail kit" | "Project package" | "Material" | "Service package";
  inventoryType?: "Inhouse" | "Catalog" | "Supplier";
  active?: boolean;
  projectOverview?: string;
  objectives?: string[];
  materialsRequired?: string[];
  learningOutcomes?: string[];
  buildSteps?: string[];
  controlMethods?: string[];
  prerequisites?: string[];
  deliverables?: string[];
  estimatedDuration?: string;
  sourceFolder?: string;
  documentationUrl?: string;
  videoUrl?: string;
  maintenanceNotes?: string;
  note: string;
  description: string;
  specs: string[];
  audience: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced" | "Professional";
  warranty: string;
  stock: number;
  delivery: string;
  color: string;
  badge?: string;
  supplier?: string;
  image?: string;
  gallery?: string[];
  importMeta?: ProductImportMeta;
};

export type ProductImportMeta = {
  sourceSite?: string;
  creator?: string;
  license?: string;
  designId?: string;
  tags?: string[];
  sourceUrl?: string;
  subcategory?: string;
  structuredSpecs?: { key: string; value: string }[];
  stats?: Record<string, number>;
  pricing?: Record<string, unknown>;
};

export const galleryImages = (product: Pick<Product, "image" | "gallery">): string[] => {
  const gallery = (product.gallery ?? []).filter(Boolean);
  if (product.image && !gallery.includes(product.image)) return [product.image, ...gallery];
  return gallery;
};

/** Re-export local seed data for backward compatibility and seeding. */
export const products: Product[] = localProducts;

export const formatNPR = (value: number) => `NPR ${value.toLocaleString("en-IN")}`;
export const findProduct = (slug: string) => products.find((product) => product.id === slug);

export const PAGE_SIZE = 20;

// ===== C2 (2026-09-23): sort + price/stock filters (shared by /products UI,
// the products API, and mirrored 1:1 by the app's Shop screen) =====
export const SORT_OPTIONS = ["featured", "price-asc", "price-desc", "name"] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];

export const SORT_LABELS: Record<SortOption, string> = {
  featured: "Featured",
  "price-asc": "Price: low to high",
  "price-desc": "Price: high to low",
  name: "Name A–Z",
};

// Price ceilings in NPR (0 = any price). Quote-only rows (price 0) never
// match a ceiling — filtering by price implies a buyable budget.
export const PRICE_CEILINGS = [0, 500, 1000, 2500, 5000, 10000] as const;
export const priceCeilingLabel = (ceiling: number) =>
  ceiling === 0 ? "Any price" : `Up to NPR ${ceiling.toLocaleString("en-IN")}`;

export function isSortOption(value: string): value is SortOption {
  return (SORT_OPTIONS as readonly string[]).includes(value);
}

// 'featured' preserves the curated sort_order the list arrived in.
export function sortProducts(list: Product[], sort: SortOption): Product[] {
  const sorted = [...list];
  if (sort === "price-asc")
    sorted.sort((a, b) => a.price - b.price || a.name.localeCompare(b.name));
  else if (sort === "price-desc")
    sorted.sort((a, b) => b.price - a.price || a.name.localeCompare(b.name));
  else if (sort === "name") sorted.sort((a, b) => a.name.localeCompare(b.name));
  return sorted;
}

export function withinPrice(list: Product[], ceiling: number): Product[] {
  if (!ceiling) return list;
  return list.filter((p) => p.price > 0 && p.price <= ceiling);
}

export function inStockOnly(list: Product[], only: boolean): Product[] {
  return only ? list.filter((p) => p.stock > 0) : list;
}

// Narrow a product list by catalog scope. The three customer catalogs are
// DISJOINT (U-44, owner 2026-09-26): "components" (Electronic Products) is
// everything except robot cars / pre-packaged kits / project packages AND 3D
// Models (3D prints live ONLY on /3d-printing); "models" is the 3D-store
// scope (category "3D Models"); "cars" is robot cars only; "projects" is
// project packages PLUS Pre-packaged Kits (owner: kits display on the
// projects page). The general category field stays "Robot Cars" for cars and
// kits — load-bearing for the admin project window — never repurpose it.
export function applyScope(all: Product[], scope: string): Product[] {
  if (scope === "models")
    return all.filter((p) => p.category?.trim().toLowerCase() === "3d models");
  if (scope === "cars") return all.filter((p) => p.project_category === "Robo Car");
  if (scope === "projects")
    return all.filter(
      (p) => p.productType === "Project package" || p.category === "Pre-packaged Kits"
    );
  return all.filter(
    (p) =>
      !["Robot Cars", "Pre-packaged Kits"].includes(p.category) &&
      p.category?.trim().toLowerCase() !== "3d models" &&
      p.productType !== "Project package"
  );
}

// Combine a category and a free-text query into a single filter predicate.
export function filterProducts(list: Product[], category: string, query: string): Product[] {
  const needle = query.trim().toLowerCase();
  return list.filter((p) => {
    if (category !== "All" && p.category !== category) return false;
    if (!needle) return true;
    return `${p.name} ${p.note} ${p.description}`.toLowerCase().includes(needle);
  });
}

// Split a (already scoped + filtered) list into pages for the catalog.
export function paginate(list: Product[], page: number, pageSize = PAGE_SIZE) {
  const total = list.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    items: list.slice(start, start + pageSize),
    page: safePage,
    total,
    totalPages,
    hasMore: safePage < totalPages,
  };
}

// ===== C3 (2026-09-23): related products + recently viewed (shared by
// ProductDetailPro/ProductCatalog and mirrored 1:1 by the app's productService)
// =====

export const RECENTLY_VIEWED_LIMIT = 8;

/**
 * Related products: same category first (closest price when several),
 * then active same-type items. Excludes the product itself; cap 4.
 */
export function relatedProducts(all: Product[], current: Product, limit = 4): Product[] {
  const candidates = all.filter((p) => p.id !== current.id && p.active !== false);
  const sameCategory = candidates
    .filter((p) => p.category === current.category)
    .sort(
      (a, b) =>
        Math.abs(a.price - current.price) - Math.abs(b.price - current.price) ||
        a.name.localeCompare(b.name)
    );
  const sameType = candidates.filter(
    (p) => p.category !== current.category && p.productType === current.productType
  );
  return [...sameCategory, ...sameType].slice(0, limit);
}

/**
 * Add a product id to the recently-viewed list (pure — returns the new
 * list): most-recent first, self deduped, capped at the limit.
 */
export function pushRecentlyViewed(
  viewed: string[],
  productId: string,
  limit = RECENTLY_VIEWED_LIMIT
): string[] {
  const next = [productId, ...viewed.filter((id) => id !== productId)];
  return next.slice(0, limit);
}

/**
 * Resolve recently-viewed ids against the catalog: active products only,
 * keeping the view order (most recent first). The current product is
 * excluded so the row never shows the page you are on.
 */
export function resolveRecentlyViewed(
  all: Product[],
  viewedIds: string[],
  excludeId?: string,
  limit = RECENTLY_VIEWED_LIMIT
): Product[] {
  const byId = new Map(all.map((p) => [p.id, p]));
  const out: Product[] = [];
  for (const id of viewedIds) {
    if (out.length >= limit) break;
    if (id === excludeId) continue;
    const product = byId.get(id);
    if (product && product.active !== false && !out.some((p) => p.id === id)) {
      out.push(product);
    }
  }
  return out;
}
