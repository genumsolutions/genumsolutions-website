import type { CartLine } from "./customer";

export const CART_KEY = "genum-cart";
export const MAX_QUANTITY_PER_LINE = 99;

// Safe reader: never throws, drops malformed lines, clamps to sane bounds.
export function readLocalCart(): CartLine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(window.localStorage.getItem(CART_KEY) || "[]");
    if (!Array.isArray(raw)) return [];
    return raw
      .filter(
        (line: unknown): line is CartLine =>
          Boolean(line && typeof line === "object") &&
          typeof (line as CartLine).productId === "string" &&
          Number.isFinite((line as CartLine).quantity)
      )
      .map((line: CartLine) => ({
        productId: line.productId,
        quantity: Math.max(1, Math.min(MAX_QUANTITY_PER_LINE, Math.floor(line.quantity))),
      }))
      .filter((line: CartLine) => line.productId.length > 0);
  } catch {
    return [];
  }
}

export function writeLocalCart(lines: CartLine[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CART_KEY, JSON.stringify(lines));
}

export function clearLocalCart() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(CART_KEY);
}

/**
 * Merge a guest cart into the signed-in cart at sign-in time.
 *
 * Same rule as CartProvider's reconcile and the native app's mergeCarts:
 * the server cart is the source of truth per product, and guest lines for
 * products the server does not have are appended. The previous additive
 * union doubled a product that was already in the signed-in cart (guest 2 +
 * server 2 became 4), which the providers then never corrected.
 */
export function mergeGuestCart(server: CartLine[], guest: CartLine[]): CartLine[] {
  const serverIds = new Set(server.map((line) => line.productId));
  return [
    ...server,
    ...guest.filter((line) => !serverIds.has(line.productId) && line.quantity > 0),
  ];
}
