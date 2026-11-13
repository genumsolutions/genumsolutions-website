import { describe, expect, it } from "vitest";
import { mergeGuestCart } from "../lib/cart-client";

describe("mergeGuestCart", () => {
  it("keeps the server quantity for a product already on the server", () => {
    const merged = mergeGuestCart(
      [{ productId: "a", quantity: 2 }],
      [{ productId: "a", quantity: 3 }]
    );
    expect(merged).toEqual([{ productId: "a", quantity: 2 }]);
  });

  it("appends guest-only products", () => {
    const merged = mergeGuestCart(
      [{ productId: "a", quantity: 1 }],
      [{ productId: "b", quantity: 4 }]
    );
    expect(merged).toEqual([
      { productId: "a", quantity: 1 },
      { productId: "b", quantity: 4 },
    ]);
  });

  it("drops empty guest lines", () => {
    expect(mergeGuestCart([], [{ productId: "a", quantity: 0 }])).toEqual([]);
  });
});
