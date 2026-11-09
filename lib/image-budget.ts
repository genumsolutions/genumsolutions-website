// =====================================================================
// image-budget.ts — the WebP encoder that enforces the shared image budget.
//
// Why this exists: the Supabase free plan gives 1 GB of Storage and the
// project had 32 product images already eating 23.6 MB — an average of
// 754 KB per photo, because `link-import` and /api/admin/upload stored the
// bytes the CDN happened to serve. At that rate the bucket fills after a few
// hundred products, and every storefront visitor downloads a full-size JPEG
// over a mobile connection.
//
// The numbers live in lib/image-limits.ts (no sharp import, so any server
// module can read the budget without pulling the native encoder into its
// bundle). A product therefore costs at most 2.4 MB of Storage, and the
// storefront serves ~40–120 KB per card instead of 750 KB.
// =====================================================================
import sharp from "sharp";
import type { Metadata } from "sharp";

import { IMAGE_BUDGET } from "./image-limits";

export { ACCEPTED_IMAGE_TYPES, clampGallery, formatBytes, IMAGE_BUDGET } from "./image-limits";

export type OptimizedImage = {
  bytes: Buffer;
  contentType: "image/webp" | "image/gif";
  extension: "webp" | "gif";
  width: number;
  height: number;
  /** Bytes we were given, so callers can report the saving. */
  originalBytes: number;
};

/**
 * Decode, downscale and re-encode an image so it fits IMAGE_BUDGET.
 *
 * Animated GIFs are passed through untouched: sharp would flatten them to the
 * first frame, and silently turning an animation into a still is worse than
 * storing one larger file. Everything else becomes WebP.
 *
 * Throws when the input is not a decodable image or is over maxUploadBytes;
 * callers turn that into a 4xx with the thrown message.
 */
export async function optimizeImage(input: Buffer | Uint8Array): Promise<OptimizedImage> {
  const source = Buffer.isBuffer(input) ? input : Buffer.from(input);
  if (source.byteLength === 0) throw new Error("That image is empty.");
  if (source.byteLength > IMAGE_BUDGET.maxUploadBytes)
    throw new Error(
      `That image is ${(source.byteLength / 1048576).toFixed(1)} MB — the limit is ${
        IMAGE_BUDGET.maxUploadBytes / 1048576
      } MB.`
    );

  let meta: Metadata;
  try {
    meta = await sharp(source, { animated: true }).metadata();
  } catch {
    throw new Error("That file is not an image we can read (use JPG, PNG, WebP, AVIF, or GIF).");
  }
  if (!meta.width || !meta.height) throw new Error("That image has no readable dimensions.");

  if (meta.format === "gif" && (meta.pages ?? 1) > 1) {
    return {
      bytes: source,
      contentType: "image/gif",
      extension: "gif",
      width: meta.width,
      height: meta.height,
      originalBytes: source.byteLength,
    };
  }

  let quality = IMAGE_BUDGET.quality;
  let edge: number = IMAGE_BUDGET.maxEdge;
  let out = await encode(source, edge, quality);

  // Step down until the file fits. Reducing quality first keeps detail; the
  // dimension cut only kicks in when quality alone cannot get us there.
  while (out.bytes.byteLength > IMAGE_BUDGET.maxStoredBytes) {
    if (quality > IMAGE_BUDGET.minQuality) {
      quality -= 10;
    } else if (edge > 900) {
      edge = Math.round(edge * 0.8);
      quality = IMAGE_BUDGET.quality;
    } else {
      break;
    }
    out = await encode(source, edge, quality);
  }

  return {
    bytes: out.bytes,
    contentType: "image/webp",
    extension: "webp",
    width: out.width,
    height: out.height,
    originalBytes: source.byteLength,
  };
}

async function encode(source: Buffer, edge: number, quality: number) {
  const pipeline = sharp(source, { animated: false })
    .rotate() // honour EXIF orientation before we strip the metadata
    .resize({
      width: edge,
      height: edge,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality, effort: 4 });
  const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
  return { bytes: data, width: info.width, height: info.height };
}
