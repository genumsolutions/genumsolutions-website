// =====================================================================
// Theme preference core (W-6 web dark mode — parity with the app, 2-way).
//
// Owner decision 2026-09-22: the theme toggle is reduced to TWO explicit
// modes — "light" and "dim" — with no "system"/OS-follow option and no
// OS listener (the shared `profiles.theme_preference` supports only these
// two values too). Legacy 'system' values (the old default + anything the
// old 3-way toggle wrote) migrate to 'dim' on read; a visitor with no
// stored choice gets 'light'.
//
// The site ships ONE semantic theme ("light") plus a "dim" overlay keyed
// off `html[data-theme='dim']` (see globals.css). Pure functions only —
// the DOM bits are isolated so tests can cover the logic.
// =====================================================================

export type ThemePreference = "light" | "dim";

export const THEME_STORAGE_KEY = "genum-theme";

export const THEME_PREFERENCES: readonly ThemePreference[] = ["light", "dim"] as const;

/** Default for a visitor with no stored preference (owner decision 2026-09-22). */
export const DEFAULT_THEME: ThemePreference = "light";

/** Legacy 'system' (OS-follow) resolves to dim — owner decision 2026-09-22. */
export const LEGACY_SYSTEM_THEME: ThemePreference = "dim";

/**
 * Stored preference from localStorage. Only 'light'/'dim' are valid going
 * forward. Legacy values migrate: the old 'system' (OS-follow default)
 * becomes 'dim'; anything unknown, missing, or unreadable becomes 'light'.
 */
export function readStoredPreference(
  storage: Pick<Storage, "getItem"> | null | undefined
): ThemePreference {
  try {
    const raw = storage?.getItem(THEME_STORAGE_KEY);
    if (raw === "dim" || raw === "light") return raw;
    if (raw === "system") return LEGACY_SYSTEM_THEME;
    return DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

/** Persist the preference (swallowing private-mode/security errors). */
export function writeStoredPreference(
  storage: Pick<Storage, "setItem"> | null | undefined,
  preference: ThemePreference
) {
  try {
    storage?.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Storage unavailable (private mode, disabled cookies) — keep in-memory only.
  }
}

/** Mirror of the layout's pre-paint script: resolves the attribute value without the DOM. */
export function inlineThemeAttributeValue(): string {
  return `try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');var p=(t==='light'||t==='dim')?t:(t==='system'?'dim':'light');document.documentElement.setAttribute('data-theme',p)}catch(e){}`;
}

/** Apply the effective theme to the document root. Safe to call anywhere client-side. */
export function applyThemePreference(
  preference: ThemePreference,
  document_: Pick<Document, "documentElement">
): ThemePreference {
  document_.documentElement.setAttribute("data-theme", preference);
  return preference;
}

/** Next stop in the toggle cycle: light ↔ dim. */
export function nextThemePreference(current: ThemePreference): ThemePreference {
  const index = THEME_PREFERENCES.indexOf(current);
  return THEME_PREFERENCES[(index + 1) % THEME_PREFERENCES.length] ?? "light";
}
