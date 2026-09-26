import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ProductDetailPro from "../../../components/ProductDetailPro";
import ProductJsonLd from "../../../components/ProductJsonLd";
import BreadcrumbListJsonLd from "../../../components/BreadcrumbListJsonLd";
import PageShell from "../../../components/PageShell";
import { getManagedProducts } from "../../../lib/content-store";
import { applyScope } from "../../../lib/catalog";

export function generateStaticParams() {
  return [];
}

export const dynamic = "force-dynamic";

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
  // for the related-products row and bundle rows) previously received the
  // WHOLE catalog, leaking 3D-model and project rows into this route's RSC
  // payload. Scope SERVER-SIDE to the Electronic Products catalog — the
  // related row then stays within the same scope it is browsed from.
  const products = applyScope(await getManagedProducts(), "components");
  const product = products.find((item) => item.id === params.slug);
  if (!product) notFound();
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
