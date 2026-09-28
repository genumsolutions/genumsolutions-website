import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ProductDetailPro from "../../../components/ProductDetailPro";
import ProductJsonLd from "../../../components/ProductJsonLd";
import BreadcrumbListJsonLd from "../../../components/BreadcrumbListJsonLd";
import PageShell from "../../../components/PageShell";
import { getManagedProducts } from "../../../lib/content-store";
import { detailCatalog } from "../../../lib/catalog";

export function generateStaticParams() {
  return [];
}

// U-48: no force-dynamic — `generateStaticParams` returns [] so every slug
// renders on first request and is then cached, revalidated in the background
// (layout `revalidate = 300`). Product edits bust this exact slug via
// revalidateProducts(product.id); a delete busts it too.

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const product = (await getManagedProducts()).find((item) => item.id === params.slug);
  if (!product) return {};
  const description = (product.note || product.description || "").slice(0, 155);
  return {
    title: product.name,
    description,
    alternates: { canonical: `/products/${product.id}` },
    openGraph: {
      title: product.name,
      description,
      url: `/products/${product.id}`,
      images: product.image ? [{ url: product.image, alt: product.name }] : undefined,
    },
  };
}

export default async function ProductPage({ params }: { params: { slug: string } }) {
  // U-47v4 (deep-check finding): ProductDetailPro's allProducts prop (used
  // for the related-products row and bundle rows) used to receive the WHOLE
  // catalog, leaking every row into this route's RSC payload.
  //
  // U-48b (owner report 2026-09-28: "the 3d product page ... says missing"):
  // the LOOKUP was scoped to "components" too, which excludes 3D Models, Project
  // packages, Pre-packaged Kits and Robot Cars — so every card on /3d-printing
  // and /projects linked here and 404'd ("That page went missing."). This one
  // route serves all three catalogs, so the product is resolved from the whole
  // catalog and the prop is scoped per product (own catalog + the two bundle
  // scopes) by detailCatalog() — the payload fix stays, the 404s go.
  const all = await getManagedProducts();
  const product = all.find((item) => item.id === params.slug);
  if (!product) notFound();
  const products = detailCatalog(all, product);
  return (
    <>
      <ProductJsonLd product={product} />
      <BreadcrumbListJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "Products", path: "/products" },
          { name: product.name, path: `/products/${product.id}` },
        ]}
      />
      {/* C3: full list powers the "Related products" row. */}
      <PageShell>
        <ProductDetailPro product={product} allProducts={products} />
      </PageShell>
    </>
  );
}
