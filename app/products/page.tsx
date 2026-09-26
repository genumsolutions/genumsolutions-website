import type { Metadata } from "next";
import BreadcrumbListJsonLd from "../../components/BreadcrumbListJsonLd";
import PageIntro from "../../components/PageIntro";
import PageShell from "../../components/PageShell";
import ProductCatalog from "../../components/ProductCatalog";
import { getManagedProducts } from "../../lib/content-store";
import { applyScope, isSortOption } from "../../lib/catalog";

export const metadata: Metadata = {
  title: "Products",
  description:
    "Robotics kits, controllers, sensors, motors, and electronics — sourced, tested, and ready to build with.",
};

export const dynamic = "force-dynamic";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams?: {
    page?: string;
    q?: string;
    category?: string;
    sort?: string;
    maxPrice?: string;
    inStock?: string;
  };
}) {
  // U-47v3 (deep-check finding): the page previously handed the WHOLE
  // catalog to the client component and scoped it in the browser — the RSC
  // flight payload then shipped all 49 3D-model rows to /products (hidden,
  // but visible to any view-source / API consumer, and the source of the
  // owner's "database still mixes 3D" reports on cached/payload-reading
  // clients). Scope SERVER-SIDE so this route only ever receives the
  // Electronic Products rows.
  const products = applyScope(await getManagedProducts(), "components").filter(
    (p) => p.active !== false
  );

  const initialPage = Math.max(1, Number(searchParams?.page) || 1);
  const initialQuery = String(searchParams?.q || "");
  const initialCategory = String(searchParams?.category || "All");
  const rawSort = String(searchParams?.sort || "featured");
  const initialSort = isSortOption(rawSort) ? rawSort : "featured";
  // C2 (2026-09-23): only recognized ceilings are honored; anything else
  // falls back to "any price" rather than silently filtering to nothing.
  const rawMaxPrice = Number(searchParams?.maxPrice) || 0;
  const initialMaxPrice = [500, 1000, 2500, 5000, 10000].includes(rawMaxPrice) ? rawMaxPrice : 0;
  const initialInStock = searchParams?.inStock === "1" || searchParams?.inStock === "true";

  return (
    <PageShell>
      <BreadcrumbListJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "Products", path: "/products" },
        ]}
      />
      <PageIntro
        eyebrow="Electronic Products"
        title="Choose the part, then build."
        body="Controllers, motors, sensors, displays, power, and tools — every part is a tap away."
      />
      <ProductCatalog
        scope="components"
        products={products}
        initialPage={initialPage}
        initialQuery={initialQuery}
        initialCategory={initialCategory}
        initialSort={initialSort}
        initialMaxPrice={initialMaxPrice}
        initialInStock={initialInStock}
      />
    </PageShell>
  );
}
