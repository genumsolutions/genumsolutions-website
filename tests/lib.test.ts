import { describe, expect, it } from "vitest";
import { initials } from "../lib/identity";
import {
  applyScope,
  filterProducts,
  formatNPR,
  galleryImages,
  inStockOnly,
  isSortOption,
  paginate,
  pushRecentlyViewed,
  relatedProducts,
  resolveRecentlyViewed,
  sortProducts,
  withinPrice,
  type Product,
} from "../lib/catalog";
import { checkRateLimit } from "../lib/rate-limit";

describe("sortProducts (C2)", () => {
  const list: Product[] = [
    { id: "b", name: "Beta", price: 500, stock: 0 },
    { id: "a", name: "Alpha", price: 1000, stock: 3 },
    { id: "c", name: "Gamma", price: 250, stock: 1 },
  ] as Product[];

  it("featured preserves the curated order", () => {
    expect(sortProducts(list, "featured").map((p) => p.id)).toEqual(["b", "a", "c"]);
  });

  it("price-asc sorts by price with name tiebreak", () => {
    const tie: Product[] = [
      { id: "x", name: "Zeta", price: 100, stock: 1 },
      { id: "y", name: "Alpha", price: 100, stock: 1 },
    ] as Product[];
    expect(sortProducts(tie, "price-asc").map((p) => p.id)).toEqual(["y", "x"]);
    expect(sortProducts(list, "price-asc").map((p) => p.id)).toEqual(["c", "b", "a"]);
  });

  it("price-desc sorts high to low", () => {
    expect(sortProducts(list, "price-desc").map((p) => p.id)).toEqual(["a", "b", "c"]);
  });

  it("name sorts alphabetically", () => {
    expect(sortProducts(list, "name").map((p) => p.id)).toEqual(["a", "b", "c"]);
  });

  it("does not mutate the input list", () => {
    const original: Product[] = [{ id: "b", name: "Beta", price: 5, stock: 1 }] as Product[];
    sortProducts(original, "name");
    expect(original[0]?.id).toBe("b");
  });
});

describe("price/stock filters (C2)", () => {
  const list: Product[] = [
    { id: "cheap", name: "Cheap", price: 250, stock: 2 },
    { id: "mid", name: "Mid", price: 900, stock: 0 },
    { id: "pricey", name: "Pricey", price: 4000, stock: 5 },
    { id: "quote", name: "Quote only", price: 0, stock: 0 },
  ] as Product[];

  it("withinPrice keeps quote-only rows out of every ceiling", () => {
    expect(withinPrice(list, 500).map((p) => p.id)).toEqual(["cheap"]);
    expect(withinPrice(list, 10000).map((p) => p.id)).toEqual(["cheap", "mid", "pricey"]);
  });

  it("withinPrice with ceiling 0 (any price) changes nothing", () => {
    expect(withinPrice(list, 0)).toHaveLength(4);
  });

  it("inStockOnly drops zero-stock rows", () => {
    expect(inStockOnly(list, true).map((p) => p.id)).toEqual(["cheap", "pricey"]);
    expect(inStockOnly(list, false)).toHaveLength(4);
  });

  it("isSortOption guards unknown values", () => {
    expect(isSortOption("price-asc")).toBe(true);
    expect(isSortOption("cheap-first")).toBe(false);
  });
});

describe("initials", () => {
  it("returns two initials from a full name", () => {
    expect(initials("Aarya Sharma")).toBe("AS");
  });

  it("returns one initial for a single word", () => {
    expect(initials("Madan")).toBe("M");
  });

  it("derives initials from an email address", () => {
    expect(initials("aarya.sharma@example.com")).toBe("AS");
  });

  it("uppercases lowercase input", () => {
    expect(initials("aarya sharma")).toBe("AS");
  });

  it("falls back to ? for empty input", () => {
    expect(initials("")).toBe("?");
  });

  it("falls back to ? for whitespace-only input", () => {
    expect(initials("   ")).toBe("?");
  });
});

describe("formatNPR", () => {
  it("formats whole rupees with Indian digit grouping", () => {
    expect(formatNPR(2500)).toMatch(/^NPR 2,500$/);
  });

  it("formats large amounts", () => {
    expect(formatNPR(1250000)).toMatch(/NPR 12,50,000/);
  });

  it("formats zero", () => {
    expect(formatNPR(0)).toBe("NPR 0");
  });
});

describe("checkRateLimit", () => {
  it("allows requests under the limit", () => {
    const key = `test-allow-${Math.random()}`;
    for (let i = 0; i < 3; i++) {
      expect(checkRateLimit(key, 5, 60_000).allowed).toBe(true);
    }
  });

  it("blocks requests over the limit and reports retry time", () => {
    const key = `test-block-${Math.random()}`;
    for (let i = 0; i < 5; i++) checkRateLimit(key, 5, 60_000);
    const result = checkRateLimit(key, 5, 60_000);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
    expect(result.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it("tracks keys independently", () => {
    const keyA = `test-a-${Math.random()}`;
    const keyB = `test-b-${Math.random()}`;
    for (let i = 0; i < 5; i++) checkRateLimit(keyA, 5, 60_000);
    expect(checkRateLimit(keyA, 5, 60_000).allowed).toBe(false);
    expect(checkRateLimit(keyB, 5, 60_000).allowed).toBe(true);
  });
});

function makeProducts(count: number, category = "Sensors"): Product[] {
  return Array.from({ length: count }, (_, i): Product => {
    const n = i + 1;
    return {
      id: `p${n}`,
      name: `Product ${n}`,
      category,
      price: 100 * n,
      priceLabel: `NPR ${100 * n}`,
      sku: `SKU-${n}`,
      productType: "Retail kit",
      note: `Note ${n}`,
      description: `Description ${n}`,
      specs: [],
      audience: "Everyone",
      difficulty: "Beginner",
      warranty: "None",
      stock: 5,
      delivery: "1-2 days",
      color: "from-white to-white",
    };
  });
}

describe("paginate", () => {
  it("returns the first page slice and reports hasMore", () => {
    const result = paginate(makeProducts(25), 1, 12);
    expect(result.items).toHaveLength(12);
    expect(result.page).toBe(1);
    expect(result.total).toBe(25);
    expect(result.totalPages).toBe(3);
    expect(result.hasMore).toBe(true);
  });

  it("returns the next page slice", () => {
    const result = paginate(makeProducts(25), 2, 12);
    expect(result.items).toHaveLength(12);
    expect(result.hasMore).toBe(true);
  });

  it("reports no more pages at the end", () => {
    const result = paginate(makeProducts(25), 3, 12);
    expect(result.items).toHaveLength(1);
    expect(result.hasMore).toBe(false);
  });

  it("clamps an out-of-range page to the last valid page", () => {
    const result = paginate(makeProducts(5), 99, 12);
    expect(result.page).toBe(1);
    expect(result.hasMore).toBe(false);
    expect(result.items).toHaveLength(5);
  });

  it("handles an empty list", () => {
    const result = paginate([], 1, 12);
    expect(result.items).toHaveLength(0);
    expect(result.totalPages).toBe(1);
    expect(result.hasMore).toBe(false);
  });
});

describe("relatedProducts + recently viewed (C3)", () => {
  const make = (
    id: string,
    category: string,
    price: number,
    productType: Product["productType"] = "Retail kit",
    active = true
  ): Product => ({
    id,
    name: `Product ${id}`,
    category,
    price,
    priceLabel: `NPR ${price}`,
    sku: id,
    productType,
    active,
    note: "",
    description: "",
    specs: [],
    audience: "",
    difficulty: "Beginner",
    warranty: "",
    stock: 5,
    delivery: "",
    color: "",
  });
  const current = make("cur", "Sensors", 1000);
  const catalog = [
    current,
    make("s1", "Sensors", 900),
    make("s2", "Sensors", 1200),
    make("s3", "Sensors", 2000, "Retail kit", false), // inactive same-category
    make("k1", "Kits", 1000), // same type, different category
    make("k2", "Kits", 5000, "Project package"), // different category + type
  ];

  it("orders same-category by price proximity, then same-type, excluding self and inactive", () => {
    const related = relatedProducts(catalog, current);
    expect(related.map((p) => p.id)).toEqual(["s1", "s2", "k1"]);
  });

  it("caps at the limit", () => {
    const many = [
      ...Array.from({ length: 6 }, (_, i) => make(`x${i}`, "Sensors", 100 + i)),
      current,
    ];
    expect(relatedProducts(many, current)).toHaveLength(4);
  });

  it("pushRecentlyViewed dedupes, recaps, and caps", () => {
    expect(pushRecentlyViewed(["a", "b", "c"], "b")).toEqual(["b", "a", "c"]);
    expect(pushRecentlyViewed([], "a")).toEqual(["a"]);
    const long = Array.from({ length: 10 }, (_, i) => `id${i}`);
    const pushed = pushRecentlyViewed(long, "new");
    expect(pushed).toHaveLength(8);
    expect(pushed[0]).toBe("new");
  });

  it("resolveRecentlyViewed keeps view order, skips inactive/unknown, excludes current", () => {
    const resolved = resolveRecentlyViewed(catalog, ["s2", "zzz", "s3", "cur", "s1"], "cur");
    expect(resolved.map((p) => p.id)).toEqual(["s2", "s1"]);
  });

  it("resolveRecentlyViewed does not mutate the input list", () => {
    const snapshot = [...catalog];
    resolveRecentlyViewed(catalog, ["s1"]);
    expect(catalog).toEqual(snapshot);
  });
});

describe("filterProducts", () => {
  it("filters by category", () => {
    const list = [...makeProducts(3, "Sensors"), ...makeProducts(2, "Motors")];
    expect(filterProducts(list, "Motors", "")).toHaveLength(2);
  });

  it("filters by free-text query across name, note and description", () => {
    const list = makeProducts(4);
    expect(filterProducts(list, "All", "note 2")).toHaveLength(1);
  });

  it("matches on product name", () => {
    const list = makeProducts(3);
    expect(filterProducts(list, "All", "product 3")).toHaveLength(1);
  });

  it("filters by category and query together", () => {
    const list = [...makeProducts(3, "Sensors"), ...makeProducts(2, "Motors")];
    expect(filterProducts(list, "Motors", "product 1")).toHaveLength(1);
  });
});

describe("applyScope", () => {
  const base = makeProducts(2);
  const base0 = base[0] as Product;
  const car: Product = {
    ...base0,
    id: "car",
    category: "Robot Cars",
    project_category: "Robo Car",
  };
  const kit: Product = { ...base0, id: "kit", category: "Pre-packaged Kits" };
  const project: Product = { ...base0, id: "project", productType: "Project package" };
  const all: Product[] = [...base, car, kit, project];

  it("filters to components (default) excluding cars, kits and project packages", () => {
    expect(applyScope(all, "components").map((p) => p.id)).toEqual(["p1", "p2"]);
  });

  it("narrows to robot cars only", () => {
    expect(applyScope(all, "cars").map((p) => p.id)).toEqual(["car"]);
  });

  it("narrows to project packages only", () => {
    expect(applyScope(all, "projects").map((p) => p.id)).toEqual(["project"]);
  });
});

describe("galleryImages (U-23)", () => {
  const base = makeProducts(1)[0] as Product;

  it("prepends the cover when it is not already in the gallery", () => {
    const p: Product = {
      ...base,
      image: "cover.jpg",
      gallery: ["a.jpg", "b.jpg"],
    };
    expect(galleryImages(p)).toEqual(["cover.jpg", "a.jpg", "b.jpg"]);
  });

  it("keeps the gallery order when the cover is already the lead entry", () => {
    const p: Product = {
      ...base,
      image: "cover.jpg",
      gallery: ["cover.jpg", "a.jpg"],
    };
    expect(galleryImages(p)).toEqual(["cover.jpg", "a.jpg"]);
  });

  it("uses the gallery alone when there is no cover", () => {
    const p: Product = { ...base, image: "", gallery: ["a.jpg", "b.jpg"] };
    expect(galleryImages(p)).toEqual(["a.jpg", "b.jpg"]);
  });

  it("falls back to the cover image only", () => {
    const p: Product = { ...base, image: "cover.jpg", gallery: [] };
    expect(galleryImages(p)).toEqual(["cover.jpg"]);
  });

  it("returns an empty array with no images at all", () => {
    const p: Product = { ...base, image: "", gallery: undefined };
    expect(galleryImages(p)).toEqual([]);
  });
});
