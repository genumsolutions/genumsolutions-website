import type { MetadataRoute } from "next";
import { company } from "../lib/company";
import { getManagedProducts } from "../lib/content-store";

// Reads live products so DB changes are reflected on refresh.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = await getManagedProducts();
  const pages = [
    "",
    "/about",
    "/services",
    "/products",
    "/projects",
    "/3d-printing",
    "/journal",
    "/tools",
    "/contact",
    // /checkout is deliberately absent: robots.ts disallows it and it needs a cart.
    "/privacy",
    "/terms",
  ];
  return [
    ...pages.map((path) => ({
      url: `${company.url}${path}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: path === "" ? 1 : 0.7,
    })),
    // Only visible products belong in the sitemap; hidden rows 404 on their
    // detail route, so advertising them would submit dead URLs.
    ...products
      .filter((product) => product.active !== false)
      .map((product) => ({
        url: `${company.url}/products/${product.id}`,
        lastModified: new Date(),
        changeFrequency: "weekly" as const,
        priority: 0.6,
      })),
  ];
}
