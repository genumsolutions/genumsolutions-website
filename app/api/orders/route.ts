import { NextResponse } from "next/server";
import { getSessionUser } from "../../../lib/supabase/server";
import { createOrder, listOrders, logTransaction } from "../../../lib/orders";
import type { Order } from "../../../lib/customer";
import { priceRequestedItems, readCustomerFields } from "../../../lib/checkout";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in to see your orders." }, { status: 401 });
  return NextResponse.json({ orders: await listOrders(user.id) });
}

// Creates a pending order. Used directly for cash-on-delivery; the eSewa/Khalti checkout routes
// create their orders server-side and only redirect to the gateway afterwards.
// Items/prices are always re-priced server-side against the catalog so unavailable
// (out-of-stock, inactive, or non-purchasable) items cannot be ordered.
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in to place your order." }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const cart = await priceRequestedItems(body.items);
  if (!cart)
    return NextResponse.json(
      { error: "No purchasable items in your build list." },
      { status: 400 }
    );

  const customer = readCustomerFields(body, user.email);
  if (!customer.customerName || !customer.email || !customer.phone || !customer.address)
    return NextResponse.json(
      { error: "Add your name, email, phone, and delivery address." },
      { status: 400 }
    );

  const provider = (
    ["cod", "esewa", "khalti"].includes(body.provider) ? body.provider : "cod"
  ) as Order["provider"];
  const order = await createOrder({
    userId: user.id,
    items: cart.priced,
    totalNpr: cart.totalNpr,
    provider,
    ...customer,
  });
  if (!order)
    return NextResponse.json({ error: "Could not save the order. Try again." }, { status: 500 });
  if (provider === "cod") {
    await logTransaction({
      orderId: order.id,
      userId: user.id,
      provider: "cod",
      amountNpr: cart.totalNpr,
      status: "initiated",
      rawPayload: { note: "cash on delivery reserved" },
    });
  }
  return NextResponse.json({ ok: true, order });
}
