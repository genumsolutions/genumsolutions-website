/**
 * C3 (2026-09-23): recently-viewed tracking (web).
 *
 * Stores product ids in localStorage, most-recent first. Pure list logic
 * (dedupe, cap, ordering) lives in lib/catalog.ts so the app can mirror it;
 * this module only handles persistence. All functions are SSR-safe no-ops
 * on the server.
 */
import { pushRecentlyViewed } from "./catalog";

const KEY = "genum:recently-viewed";

export function loadRecentlyViewed(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string");
  } catch {
    return [];
  }
}

export function saveRecentlyViewed(ids: string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    // Safari private mode / storage disabled — tracking is best-effort.
  }
}

/** Record a product view (dedupes + recaps + caps via catalog helper). */
export function recordProductView(productId: string): void {
  saveRecentlyViewed(pushRecentlyViewed(loadRecentlyViewed(), productId));
}
