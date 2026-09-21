// =====================================================================
// Theme preference core (W-6 web dark mode — parity with the app's
// System / Light / Dim trio).
//
// The site ships ONE semantic theme ("light") plus a "dim" overlay
// keyed off `html[data-theme='dim']` (see globals.css). A preference of
// "system" follows the OS `prefers-color-scheme` and is the default,
// matching the app's default. Pure functions only — the DOM bits are
// isolated in applyThemePreference() so tests can cover the logic.
// =====================================================================

export type ThemePreference = 'system' | 'light' | 'dim'

export const THEME_STORAGE_KEY = 'genum-theme'

export const THEME_PREFERENCES: readonly ThemePreference[] = ['system', 'light', 'dim'] as const

function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dim'
}

/** Effective on-screen theme for a preference given the OS setting. */
export function resolveEffectiveTheme(preference: ThemePreference, osPrefersDark: boolean): 'light' | 'dim' {
  if (preference === 'system') return osPrefersDark ? 'dim' : 'light'
  return preference
}

/**
 * Stored preference from localStorage. Legacy values are migrated:
 * the original toggle stored 'dim' or 'light' (never 'system'); both
 * remain valid, anything else falls back to 'system' (the app default).
 */
export function readStoredPreference(storage: Pick<Storage, 'getItem'> | null | undefined): ThemePreference {
  try {
    const raw = storage?.getItem(THEME_STORAGE_KEY)
    return isThemePreference(raw) ? raw : 'system'
  } catch {
    return 'system'
  }
}

/** Persist the preference (swallowing private-mode/security errors). */
export function writeStoredPreference(storage: Pick<Storage, 'setItem'> | null | undefined, preference: ThemePreference) {
  try {
    storage?.setItem(THEME_STORAGE_KEY, preference)
  } catch {
    // Storage unavailable (private mode, disabled cookies) — keep in-memory only.
  }
}

/** Mirror of the layout's pre-paint script: resolves the attribute value without the DOM. */
export function inlineThemeAttributeValue(): string {
  return `try{var m=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches;var t=localStorage.getItem('${THEME_STORAGE_KEY}');var p=(t==='dim'||t==='light')?t:'system';var e=p==='dim'||(p==='system'&&m);document.documentElement.setAttribute('data-theme',e?'dim':'light')}catch(e){}`
}

/** Apply the effective theme to the document root. Safe to call anywhere client-side. */
export function applyThemePreference(preference: ThemePreference, osPrefersDark: boolean, document_: Pick<Document, 'documentElement'>): 'light' | 'dim' {
  const effective = resolveEffectiveTheme(preference, osPrefersDark)
  document_.documentElement.setAttribute('data-theme', effective)
  return effective
}

/** OS dark-mode query, or false when matchMedia is unavailable. */
export function prefersDarkScheme(defaultView: { matchMedia?: (query: string) => { matches: boolean } } | undefined | null): boolean {
  try {
    return Boolean(defaultView?.matchMedia?.('(prefers-color-scheme: dark)')?.matches)
  } catch {
    return false
  }
}

/** Next stop in the toggle cycle: system → light → dim → system. */
export function nextThemePreference(current: ThemePreference): ThemePreference {
  const index = THEME_PREFERENCES.indexOf(current)
  return THEME_PREFERENCES[(index + 1) % THEME_PREFERENCES.length] ?? 'system'
}
