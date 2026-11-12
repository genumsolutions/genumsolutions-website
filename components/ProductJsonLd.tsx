import { company } from "../lib/company";
import type { Product } from "../lib/catalog";

export default function ProductJsonLd({ product }: { product: Product }) {
  const isProjectPackage = product.productType === "Project package";
  const inStock = !isProjectPackage && (product.stock ?? 0) > 0;
  const availability = isProjectPackage
    ? "https://schema.org/PreOrder"
    : inStock
      ? "https://schema.org/InStock"
      : "https://schema.org/OutOfStock";

  const imageUrl = product.image
    ? /^https?:\/\//i.test(product.image)
      ? product.image
      : `${company.url}${product.image.startsWith("/") ? "" : "/"}${product.image}`
    : undefined;

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    brand: { "@type": "Brand", name: company.name },
    description: product.note || product.description,
    image: imageUrl,
    sku: product.sku || undefined,
    offers: {
      "@type": "Offer",
      priceCurrency: "NPR",
      price: product.price,
      availability,
      url: `${company.url}/products/${product.id}`,
      // Project packages are scoped/quoted; retail out-of-stock is not directly purchasable.
      itemCondition: "https://schema.org/NewCondition",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}
