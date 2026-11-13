/**
 * Quote-request validation + upload limits, shared by the public quote route
 * and the tests. Pure (no server imports) so it can be unit tested directly.
 */

export const MAX_QUOTE_FILES = 3;
export const MAX_QUOTE_FILE_BYTES = 10 * 1024 * 1024; // 10 MB per file
export const MIN_QUOTE_MESSAGE = 10;
export const MAX_QUOTE_MESSAGE = 4000;

/** Extensions accepted for a print quote. Checked by name, not MIME type —
 * browsers report STL/STEP as application/octet-stream or empty. */
export const ALLOWED_QUOTE_EXTENSIONS = [
  "stl",
  "obj",
  "3mf",
  "step",
  "stp",
  "stpz",
  "amf",
  "zip",
  "pdf",
  "jpg",
  "jpeg",
  "png",
  "webp",
] as const;

export const QUOTE_FILE_ACCEPT = ALLOWED_QUOTE_EXTENSIONS.map((ext) => `.${ext}`).join(",");

export type QuoteDraft = {
  name: string;
  email: string;
  phone: string;
  description: string;
  material: string;
  quantity: number;
  dimensions: string;
  timeline: string;
  referenceUrls: string[];
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

function httpUrls(value: unknown): string[] {
  const raw = Array.isArray(value)
    ? value
    : typeof value === "string" && value.trim()
      ? value.split(/[\n,]+/)
      : [];
  return raw
    .map((entry) => text(entry))
    .filter((entry) => /^https?:\/\/\S+$/i.test(entry))
    .slice(0, 5)
    .map((entry) => entry.slice(0, 500));
}

export type QuoteValidation = { ok: true; value: QuoteDraft } | { ok: false; error: string };

export function validateQuoteDraft(input: unknown): QuoteValidation {
  const body = (input ?? {}) as Record<string, unknown>;
  const name = text(body.name);
  const email = text(body.email);
  const phone = text(body.phone);
  const description = text(body.description);
  const material = text(body.material);
  const dimensions = text(body.dimensions);
  const timeline = text(body.timeline);
  const quantityRaw = Number(body.quantity);

  if (!name) return { ok: false, error: "Please add your name." };
  if (name.length > 100) return { ok: false, error: "Please shorten your name." };
  if (!email || email.length > 254 || !emailPattern.test(email))
    return { ok: false, error: "Please check your email address." };
  if (phone.length > 30) return { ok: false, error: "Please shorten your phone number." };
  if (description.length < MIN_QUOTE_MESSAGE)
    return { ok: false, error: "Tell us a little more about the part you need." };
  if (description.length > MAX_QUOTE_MESSAGE)
    return { ok: false, error: "Please shorten the description." };
  if (material.length > 80) return { ok: false, error: "Please shorten the material note." };
  if (dimensions.length > 120) return { ok: false, error: "Please shorten the dimensions." };
  if (timeline.length > 80) return { ok: false, error: "Please shorten the timeline." };
  const quantity = Number.isFinite(quantityRaw) ? Math.floor(quantityRaw) : 1;
  if (quantity < 1 || quantity > 10000)
    return { ok: false, error: "Quantity must be between 1 and 10,000." };

  return {
    ok: true,
    value: {
      name,
      email,
      phone,
      description,
      material,
      quantity,
      dimensions,
      timeline,
      referenceUrls: httpUrls(body.referenceUrls),
    },
  };
}

/** Lowercase extension of an uploaded file name, or null when disallowed. */
export function quoteFileExtension(name: string): string | null {
  const match = /\.([a-z0-9]+)$/i.exec(name.trim());
  if (!match) return null;
  const ext = (match[1] ?? "").toLowerCase();
  return (ALLOWED_QUOTE_EXTENSIONS as readonly string[]).includes(ext) ? ext : null;
}

/** Storage-safe object name: never reuse the customer's path/characters. */
export function quoteStorageName(originalName: string): string {
  const ext = quoteFileExtension(originalName) ?? "bin";
  const base = originalName
    .replace(/\.[a-z0-9]+$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${base || "part"}.${ext}`;
}
