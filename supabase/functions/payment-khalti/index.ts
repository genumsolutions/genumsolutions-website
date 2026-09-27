import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// C1 fix (2026-09-23): fall back to the runtime-injected standard names so
// the module always boots (see payment-esewa note).
const supabaseUrl = Deno.env.get("NEXT_PUBLIC_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL") ?? "";
const supabaseAnonKey =
  Deno.env.get("NEXT_PUBLIC_SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const khaltiSecretKey = Deno.env.get("KHALTI_SECRET_KEY")!;
const khaltiBaseUrl = Deno.env.get("KHALTI_BASE_URL") || "https://a.khalti.com/api/v2";

// Order updates + transactions require service privileges (admin RLS /
// append-only ledger); reads fall back to the anon client so web keeps working.
const serviceClient = supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function html(body: string, status = 200) {
  return new Response(body, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
    status,
  });
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

/**
 * U-48 (2026-09-27): amount guard for the two verify paths.
 *
 * `initiate` is now server-authoritative (it charges the order's own
 * total_npr), so a cheap-amount payment can no longer be settled. This is
 * defence in depth for the remaining case: a completed gateway payment whose
 * amount disagrees with the order.
 *
 * Khalti is not consistent about which field it returns from /epayment/lookup/:
 * `total_amount` is paisa (int), `amount` is rupees (float). We check whichever
 * is present, in its own unit, and treat an ABSENT/NaN field as "cannot tell"
 * (allowed) so a field-name change can never block a genuine payment.
 */
function amountMatches(verifyResult: any, orderTotalNpr: unknown): boolean {
  const total = Number(orderTotalNpr);
  if (!Number.isFinite(total)) return true;

  const paisa = Number(verifyResult?.total_amount);
  if (Number.isFinite(paisa)) return Math.abs(paisa - total * 100) < 100;

  const rupees = Number(verifyResult?.amount);
  if (Number.isFinite(rupees)) return Math.abs(rupees - total) < 1;

  return true;
}

async function findOrder(orderId: string) {
  const { data } = await supabase
    .from("orders")
    .select("id, total_npr, user_id, status, provider")
    .eq("id", orderId)
    .maybeSingle();
  return data as {
    id: string;
    total_npr: number;
    user_id: string | null;
    status: string;
    provider: string;
  } | null;
}

async function markPaidAndLog(
  order: { id: string; total_npr: number; user_id: string | null },
  providerRef: string,
  rawPayload: unknown
) {
  const db = serviceClient ?? supabase;
  // C1 (2026-09-23): status flip + stock decrement are one atomic, row-locked,
  // idempotent RPC (mark_order_paid). Returns false when the order was already
  // paid/fulfilled - the transaction ledger update still runs for audit.
  try {
    await db.rpc("mark_order_paid", {
      order_id: order.id,
      provider_ref: String(providerRef || ""),
    });
  } catch (error) {
    console.error("mark_order_paid failed", error);
  }
  await db
    .from("transactions")
    .update({
      status: "succeeded",
      raw_payload: rawPayload ?? {},
    })
    .eq("provider_ref", providerRef);
  // Best-effort cart clear so the buyer's build list empties after payment.
  await db.from("carts").upsert({
    user_id: order.user_id,
    lines: [],
    updated_at: new Date().toISOString(),
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders() });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action") || (await req.json().catch(() => ({}))).action;

  try {
    if (action === "initiate") {
      const body = await req.json().catch(() => ({}));
      const { purchaseOrderId, purchaseOrderName, customerInfo } = body;
      if (!khaltiSecretKey) {
        return json({ error: "Khalti not configured" }, 503);
      }

      // U-48 (2026-09-27) SECURITY: the charged amount used to come straight
      // from the request body. Anyone could open a real order for NPR 100,000,
      // initiate Khalti with `amount: 1`, pay NPR 1, and the order was then
      // marked paid (the verify step never compared amounts either). The amount
      // is now SERVER-AUTHORITATIVE from the order row, exactly like
      // payment-esewa already did - the client's `amount` is ignored entirely.
      const orderId = String(purchaseOrderId ?? "");
      if (!orderId) {
        return json({ error: "order id is required" }, 400);
      }
      const order = await findOrder(orderId);
      if (!order) {
        return json({ error: "Unknown order" }, 404);
      }
      if (order.status === "paid") {
        return json({ error: "This order is already paid" }, 409);
      }
      if (order.provider !== "khalti") {
        return json({ error: "Order does not belong to this payment provider" }, 400);
      }
      const amountNpr = Math.max(0, Math.floor(Number(order.total_npr) || 0));
      if (amountNpr <= 0) {
        return json({ error: "Order total is invalid" }, 400);
      }

      // Return to the edge function itself, which verifies then redirects the
      // browser back into the native app via its custom scheme.
      const fnOrigin = `${url.protocol}//${url.host}${url.pathname.replace(/\/$/u, "")}`;
      const returnUrl = `${fnOrigin}?action=return&order=${encodeURIComponent(orderId)}`;
      // Khalti requires a website_url; any valid https site on this Supabase
      // project satisfies the API for a mobile-first flow.
      const websiteUrl = `${url.protocol}//${url.host}`;

      const response = await fetch(`${khaltiBaseUrl}/epayment/initiate/`, {
        method: "POST",
        headers: {
          Authorization: `Key ${khaltiSecretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          return_url: returnUrl,
          website_url: websiteUrl,
          amount: amountNpr * 100,
          purchase_order_id: orderId,
          purchase_order_name: purchaseOrderName || "GENUM order",
          customer_info: customerInfo || {},
        }),
      });

      const result = await response.json();

      if (!response.ok || !result?.payment_url) {
        return json({ error: result?.error || "Khalti initiate failed" }, 502);
      }

      const db = serviceClient ?? supabase;
      await db.from("transactions").insert({
        order_id: orderId,
        provider_ref: result.pidx || "",
        provider: "khalti",
        amount_npr: amountNpr,
        currency: "NPR",
        status: "initiated",
        raw_payload: { pidx: result.pidx, ...result },
      });

      return json({ url: result.payment_url, pidx: result.pidx, orderId });
    }

    if (action === "return") {
      const orderId = url.searchParams.get("order") || "";
      const pidx = url.searchParams.get("pidx") || "";
      if (!orderId || !pidx) {
        return html(
          `<!doctype html><html><body><script>location.replace('genumsolutions://checkout?provider=khalti&status=no-order')</script></body></html>`
        );
      }
      const order = await findOrder(orderId);
      if (!order || order.provider !== "khalti") {
        return html(
          `<!doctype html><html><body><script>location.replace('genumsolutions://checkout?provider=khalti&status=no-order')</script></body></html>`
        );
      }
      if (order.status === "paid") {
        return html(
          `<!doctype html><html><body><script>location.replace('genumsolutions://checkout/success?provider=khalti&order=${orderId}&paid=1')</script></body></html>`
        );
      }

      if (!khaltiSecretKey) {
        return html(
          `<!doctype html><html><body><script>location.replace('genumsolutions://checkout?provider=khalti&status=verify-pending')</script></body></html>`
        );
      }
      const verifyResponse = await fetch(`${khaltiBaseUrl}/epayment/lookup/`, {
        method: "POST",
        headers: {
          Authorization: `Key ${khaltiSecretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ pidx }),
      });
      const verifyResult = await verifyResponse.json().catch(() => null);
      const paid =
        verifyResult?.status === "success" && verifyResult?.payment_status === "COMPLETED";

      if (!paid || !amountMatches(verifyResult, order.total_npr)) {
        return html(
          `<!doctype html><html><body><script>location.replace('genumsolutions://checkout?provider=khalti&order=${orderId}&status=not-paid')</script></body></html>`
        );
      }
      await markPaidAndLog(order, pidx, { ...verifyResult, verifiedServerSide: true });
      return html(
        `<!doctype html><html><body><script>location.replace('genumsolutions://checkout/success?provider=khalti&order=${orderId}&paid=1')</script></body></html>`
      );
    }

    // Kept for any web/legacy caller: verify a pidx for an order.
    if (action === "verify") {
      const body = await req.json().catch(() => ({}));
      const { pidx, orderId } = body;
      if (!khaltiSecretKey) {
        return json({ valid: false });
      }
      if (!pidx) {
        return json({ valid: false, error: "pidx required" }, 400);
      }
      const verifyResponse = await fetch(`${khaltiBaseUrl}/epayment/lookup/`, {
        method: "POST",
        headers: {
          Authorization: `Key ${khaltiSecretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ pidx }),
      });
      const verifyResult = await verifyResponse.json().catch(() => null);
      const paid =
        verifyResult?.status === "success" && verifyResult?.payment_status === "COMPLETED";
      if (paid && orderId) {
        const order = await findOrder(String(orderId));
        if (order && amountMatches(verifyResult, order.total_npr))
          await markPaidAndLog(order, pidx, { ...verifyResult, verifiedServerSide: true });
      }
      return json({ valid: Boolean(verifyResult?.status === "success"), paid });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (error) {
    console.error("Khalti Edge Function error:", error);
    return json({ error: error.message ?? "Internal error" }, 500);
  }
});
