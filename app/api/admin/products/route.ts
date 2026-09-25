import { NextResponse } from "next/server";
import { isAdminRequest, isStaffRequest } from "../../../../lib/admin";
import {
  deleteProduct,
  getManagedProducts,
  saveProduct,
  type Product,
} from "../../../../lib/content-store";
import { logActivity } from "../../../../lib/activity";
import { isStorageImage } from "../../../../lib/product-image";
import { revalidateProducts } from "../../../../lib/revalidate";

export async function GET(request: Request) {
  if (!(await isStaffRequest()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const params = new URL(request.url).searchParams;
    const all = await getManagedProducts();
    const needle = (params.get("q") || "").trim().toLowerCase();
    const filtered = needle
      ? all.filter((product) =>
          `${product.id} ${product.name} ${product.sku} ${product.category}`
            .toLowerCase()
            .includes(needle)
        )
      : all;
    const page = Math.max(1, Number(params.get("page")) || 1);
    const limit = Math.min(100, Math.max(5, Number(params.get("limit")) || 20));
    return NextResponse.json({
      products: filtered.slice((page - 1) * limit, page * limit),
      total: filtered.length,
      page,
      totalPages: Math.max(1, Math.ceil(filtered.length / limit)),
    });
  } catch (error) {
    console.error("Admin product list failed", error);
    return NextResponse.json({ error: "Could not load products." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  if (!(await isStaffRequest()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json().catch(() => null);
    if (!body?.id || !body?.name || !body?.category)
      return NextResponse.json(
        { error: "Product id, name, and category are required." },
        { status: 400 }
      );
    const id = String(body.id).trim().toLowerCase().replace(/\s+/g, "-").slice(0, 120);
    if (!/^[a-z0-9-]+$/.test(id))
      return NextResponse.json(
        { error: "Product id must be alphanumeric with dashes only." },
        { status: 400 }
      );
    const name = String(body.name).trim().slice(0, 200);
    const category = String(body.category).trim().slice(0, 80);
    const price = Number(body.price);
    const stock = Number(body.stock);
    if (body.price != null && (!Number.isFinite(price) || price < 0))
      return NextResponse.json(
        { error: "Price must be a number of zero or more." },
        { status: 400 }
      );
    if (body.stock != null && (!Number.isInteger(stock) || stock < 0))
      return NextResponse.json(
        { error: "Stock must be a whole number of zero or more." },
        { status: 400 }
      );
    const specs = Array.isArray(body.specs)
      ? body.specs
          .filter((line: unknown) => typeof line === "string" && line.trim())
          .map((line: string) => line.slice(0, 500))
      : [];
    const product: Product = { ...body, id, name, category, specs };
    if (Number.isFinite(price)) product.price = price;
    if (Number.isInteger(stock)) product.stock = stock;

    // W1 (2026-09-24) — link-import image parity: the editor seeds the image
    // field with the ORIGINAL third-party URL from the extracted page (e.g.
    // makerworld.com CDN). next/image + our CSP only allow our own Supabase
    // bucket, so such a row renders with NO image on the site (the app was
    // unaffected because its create path uploads to the bucket first).
    // Before persisting, hand the foreign URL to the link-import edge
    // (action: upload-image) which downloads it SSRF-guarded, magic-byte
    // sniffed, ≤4MB — and returns a durable product-images storage URL.
    // Idempotence guard: storage URLs pass through untouched, so re-saving
    // an already-fixed row never re-downloads.
    const rawImage = typeof product.image === "string" ? product.image.trim() : "";
    if (rawImage && !isStorageImage(rawImage)) {
      try {
        const sourceUrl = String(product.documentationUrl || body?.linkImportUrl || "");
        const origin = new URL(request.url).origin;
        const edgeResponse = await fetch(`${origin}/api/admin/link-import`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            // Forward the caller's Supabase session so the edge role gate
            // sees the same staff+ identity that passed this route.
            ...(request.headers.get("authorization")
              ? { authorization: request.headers.get("authorization") as string }
              : request.headers.get("cookie")
                ? { "x-forwarded-authorization": "" }
                : {}),
            ...(request.headers.get("cookie")
              ? { cookie: request.headers.get("cookie") as string }
              : {}),
          },
          body: JSON.stringify({
            action: "upload-image",
            url: sourceUrl || rawImage,
            imageUrls: [rawImage],
          }),
        });
        const result = (await edgeResponse.json().catch(() => ({}))) as {
          imageUrl?: string;
          error?: string;
        };
        if (edgeResponse.ok && result.imageUrl) {
          product.image = result.imageUrl;
        } else {
          // Non-fatal: save the row anyway, but without a broken foreign
          // image — the catalog falls back to the category placeholder.
          console.warn("admin product image persist skipped:", result.error || edgeResponse.status);
          product.image = "";
        }
      } catch (e) {
        console.warn("admin product image persist failed:", e);
        product.image = "";
      }
    }

    // U-23 (2026-09-24) — gallery parity: every gallery entry that is still a
    // foreign URL gets uploaded to the bucket too (same upload-image path,
    // now array-aware), so multi-photo rows keep working under next/image CSP.
    if (Array.isArray(product.gallery)) {
      const foreign = product.gallery.filter(
        (src: unknown): src is string =>
          typeof src === "string" && !isStorageImage(src) && src.trim() !== ""
      );
      if (foreign.length > 0) {
        try {
          const sourceUrl = String(product.documentationUrl || body?.linkImportUrl || "");
          const origin = new URL(request.url).origin;
          const edgeResponse = await fetch(`${origin}/api/admin/link-import`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(request.headers.get("authorization")
                ? { authorization: request.headers.get("authorization") as string }
                : request.headers.get("cookie")
                  ? { "x-forwarded-authorization": "" }
                  : {}),
              ...(request.headers.get("cookie")
                ? { cookie: request.headers.get("cookie") as string }
                : {}),
            },
            body: JSON.stringify({
              action: "upload-image",
              url: sourceUrl || foreign[0],
              imageUrls: foreign,
            }),
          });
          const result = (await edgeResponse.json().catch(() => ({}))) as {
            imageUrl?: string;
            gallery?: string[];
            error?: string;
          };
          if (edgeResponse.ok && Array.isArray(result.gallery) && result.gallery.length > 0) {
            const byUrl = new Map<string, string>();
            let i = 0;
            for (const f of foreign) byUrl.set(f, result.gallery[i++] ?? f);
            const nextGallery = (product.gallery ?? []).map((src) => {
              const value = typeof src === "string" ? src : "";
              return byUrl.has(value) ? (byUrl.get(value) as string) : value;
            });
            product.gallery = nextGallery.filter(
              (value): value is string => typeof value === "string"
            );
            // Keep the cover in sync when the lead gallery entry was repaired.
            if (!product.image && product.gallery[0]) product.image = product.gallery[0];
          }
        } catch (e) {
          // Non-fatal: keep the foreign URLs; the catalog/thumbnails degrade
          // to the category placeholder for those entries.
          console.warn("admin product gallery persist failed:", e);
        }
      }
    }

    await saveProduct(product);
    await logActivity({
      action: "product.saved",
      entityType: "product",
      entityId: product.id,
      details: { name: product.name },
    });
    revalidateProducts(product.id);
    return NextResponse.json({ ok: true, product });
  } catch (error) {
    console.error("Product save failed", error);
    return NextResponse.json({ error: "Could not save the product." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!(await isStaffRequest()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdminRequest()))
    return NextResponse.json(
      { error: "Only administrators can delete products." },
      { status: 403 }
    );
  try {
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Product id is required." }, { status: 400 });
    await deleteProduct(id);
    await logActivity({ action: "product.deleted", entityType: "product", entityId: id });
    revalidateProducts(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Product deletion failed", error);
    return NextResponse.json({ error: "Could not delete the product." }, { status: 500 });
  }
}
