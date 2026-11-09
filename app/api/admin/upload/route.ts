import { NextResponse } from "next/server";

import { isStaffRequest } from "../../../../lib/admin";
import {
  ACCEPTED_IMAGE_TYPES,
  formatBytes,
  IMAGE_BUDGET,
  optimizeImage,
} from "../../../../lib/image-budget";
import { createServiceClient } from "../../../../lib/supabase/server";

// Every admin image upload goes through the shared budget in lib/image-budget.ts
// so the `product-images` bucket cannot creep back to full-size CDN originals
// (that had reached an average of 754 KB per photo on a 1 GB free tier).
// The accepted file is capped at 8 MB, then re-encoded to WebP at <=1600px and
// <=300 KB before it is stored — the response reports both sizes so the panel
// can show the saving.
export const runtime = "nodejs";

const ALLOWED = new Set<string>(ACCEPTED_IMAGE_TYPES);

export async function POST(request: Request) {
  if (!(await isStaffRequest()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File))
    return NextResponse.json({ error: "Attach an image file." }, { status: 400 });
  if (!ALLOWED.has(file.type))
    return NextResponse.json(
      { error: "Use a JPG, PNG, WebP, AVIF, or GIF image." },
      { status: 400 }
    );
  if (file.size > IMAGE_BUDGET.maxUploadBytes)
    return NextResponse.json(
      {
        error: `Image must be smaller than ${formatBytes(IMAGE_BUDGET.maxUploadBytes)}.`,
      },
      { status: 400 }
    );

  try {
    const optimized = await optimizeImage(Buffer.from(await file.arrayBuffer()));
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${optimized.extension}`;

    const db = createServiceClient();
    const { error } = await db.storage.from("product-images").upload(safeName, optimized.bytes, {
      contentType: optimized.contentType,
      cacheControl: "31536000",
      upsert: false,
    });
    if (error) throw error;
    const { data } = db.storage.from("product-images").getPublicUrl(safeName);
    return NextResponse.json({
      ok: true,
      url: data.publicUrl,
      width: optimized.width,
      height: optimized.height,
      bytes: optimized.bytes.byteLength,
      originalBytes: optimized.originalBytes,
    });
  } catch (error) {
    // optimizeImage throws a plain-language reason for unreadable or oversized
    // files; storage failures keep the bucket hint that was here before.
    const message = error instanceof Error ? error.message : "";
    if (message && !/bucket|storage/i.test(message))
      return NextResponse.json({ error: message }, { status: 400 });
    console.error("Image upload failed", error);
    return NextResponse.json(
      { error: "Upload failed. Check the product-images bucket exists." },
      { status: 500 }
    );
  }
}
