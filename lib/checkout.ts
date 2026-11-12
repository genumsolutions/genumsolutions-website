import { getManagedProducts } from "./content-store";
import type { OrderItem } from "./customer";

export type PricedLine = OrderItem;

export type PricedCart = {
  priced: PricedLine[];
  totalNpr: number;
};

// Re-prices client-sent cart lines against the database - never trust client prices.
// Only active, in-stock, directly purchasable retail items (not project packages)
// are accepted; quantities are clamped to available stock.
export async function priceRequestedItems(requested: unknown): Promise<PricedCart | null> {
  if (!Array.isArray(requested)) return null;
  const catalog = await getManagedProducts();
  const priced = requested
    .map((item: { productId?: string; quantity?: number }) => {
      const product = catalog.find((entry) => entry.id === item?.productId);
      if (!product) return null;
      if (product.active === false) return null;
      if (product.productType === "Project package") return null;
      if ((product.stock ?? 0) <= 0 || product.price <= 0) return null;
      const stock = Math.max(0, Math.floor(Number(product.stock) || 0));
      const requestedQty = Math.max(1, Math.floor(Number(item?.quantity) || 0));
      return {
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: Math.max(1, Math.min(99, Math.min(requestedQty, stock))),
      };
    })
    .filter(Boolean)
    .slice(0, 50) as PricedLine[];
  if (!priced.length) return null;
  const totalNpr = priced.reduce((sum, line) => sum + line.price * line.quantity, 0);
  return { priced, totalNpr };
}

export type CustomerFields = {
  customerName: string;
  email: string;
  phone: string;
  address: string;
};

// Normalizes the optional customer block sent by the checkout page.
export function readCustomerFields(
  body: { customer?: Record<string, unknown> } | null,
  fallbackEmail: string
): CustomerFields {
  const customer = body?.customer || {};
  return {
    customerName:
      String(customer.name || "")
        .trim()
        .slice(0, 120) || fallbackEmail,
    email:
      String(customer.email || "")
        .trim()
        .slice(0, 254) || fallbackEmail,
    phone: String(customer.phone || "")
      .trim()
      .slice(0, 40),
    address: String(customer.address || "")
      .trim()
      .slice(0, 500),
  };
}
