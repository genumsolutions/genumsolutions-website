// =====================================================================
// socials.ts - C5 (2026-09-23): social links + WhatsApp helpers.
//
// Social URLs are admin-editable in the shared company_info row (Settings
// panel on web, Company info editor in the app). An empty URL means the
// surface is not used — callers must hide the entry rather than render a
// dead link. The WhatsApp number is stored DIGITS-ONLY with country code
// (no '+'), so wa.me links build directly and validation is simple.
// =====================================================================
import type { Company } from "./company";

export type SocialLink = {
  key: string;
  label: string;
  url: string;
};

/** The admin-editable social surfaces, in display order, empty = hidden. */
export function socialLinks(
  company: Pick<
    Company,
    "facebookUrl" | "instagramUrl" | "tiktokUrl" | "linkedinUrl" | "youtubeUrl"
  >
): SocialLink[] {
  return [
    { key: "facebook", label: "Facebook", url: company.facebookUrl ?? "" },
    { key: "instagram", label: "Instagram", url: company.instagramUrl ?? "" },
    { key: "tiktok", label: "TikTok", url: company.tiktokUrl ?? "" },
    { key: "linkedin", label: "LinkedIn", url: company.linkedinUrl ?? "" },
    { key: "youtube", label: "YouTube", url: company.youtubeUrl ?? "" },
  ].filter((link) => link.url.trim().length > 0);
}

/**
 * Normalize an admin-entered WhatsApp number to the digits-only form the
 * wa.me link format expects: strips everything except leading '+' and
 * digits, then drops the '+'. '+977 986-1842 552' -> '9779861842552'.
 */
export function normalizeWhatsappNumber(raw: string): string {
  return raw.replace(/[^\d]/g, "");
}

/** Sanity-check a stored number: 8-15 digits after the country code. */
export function isValidWhatsappNumber(value: string): boolean {
  return /^\d{8,15}$/.test(normalizeWhatsappNumber(value));
}

/** Build a wa.me deep link with an optional prefilled message. */
export function whatsappLink(whatsappNumber: string, message?: string): string {
  const digits = normalizeWhatsappNumber(whatsappNumber);
  if (!digits) return "";
  const query = message?.trim() ? `?text=${encodeURIComponent(message.trim())}` : "";
  return `https://wa.me/${digits}${query}`;
}
