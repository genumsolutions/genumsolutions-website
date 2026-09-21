import { describe, expect, it } from 'vitest'
import {
  THEME_STORAGE_KEY,
  applyThemePreference,
  inlineThemeAttributeValue,
  nextThemePreference,
  prefersDarkScheme, 
  readStoredPreference,
  resolveEffectiveTheme,
  writeStoredPreference,
} from '../lib/theme'

function fakeStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial))
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
  }
}

describe('resolveEffectiveTheme', () => {
  it('system follows the OS dark setting', () => {
    expect(resolveEffectiveTheme('system', true)).toBe('dim')
    expect(resolveEffectiveTheme('system', false)).toBe('light')
  })

  it('explicit light/dim always win over the OS', () => {
    expect(resolveEffectiveTheme('light', true)).toBe('light')
    expect(resolveEffectiveTheme('dim', false)).toBe('dim')
  })
})

describe('readStoredPreference', () => {
  it('returns system when storage is empty', () => {
    expect(readStoredPreference(fakeStorage())).toBe('system')
  })

  it('accepts dim and light', () => {
    expect(readStoredPreference(fakeStorage({ [THEME_STORAGE_KEY]: 'dim' }))).toBe('dim')
    expect(readStoredPreference(fakeStorage({ [THEME_STORAGE_KEY]: 'light' }))).toBe('light')
  })

  it('migrates legacy values to system (app default)', () => {
    expect(readStoredPreference(fakeStorage({ [THEME_STORAGE_KEY]: 'blue' }))).toBe('system')
    expect(readStoredPreference(null)).toBe('system')
  })
})

describe('writeStoredPreference', () => {
  it('persists the preference', () => {
    const storage = fakeStorage()
    writeStoredPreference(storage, 'dim')
    expect(storage.getItem(THEME_STORAGE_KEY)).toBe('dim')
  })

  it('swallows storage errors (private mode)', () => {
    const throwing = { getItem: () => null, setItem: () => { throw new Error('quota') } }
    expect(() => writeStoredPreference(throwing as unknown as Storage, 'dim')).not.toThrow()
  })
})

describe('applyThemePreference', () => {
  it('sets the data-theme attribute on the document element', () => {
    let last: [string, string] | null = null
    const element = {
      setAttribute: (name: string, value: string) => { last = [name, value] },
    }
    const fakeDocument = { documentElement: element as unknown as HTMLElement }
    expect(applyThemePreference('dim', false, fakeDocument)).toBe('dim')
    expect(last).toEqual(['data-theme', 'dim'])
  })
})

describe('nextThemePreference', () => {
  it('cycles system → light → dim → system (app order)', () => {
    expect(nextThemePreference('system')).toBe('light')
    expect(nextThemePreference('light')).toBe('dim')
    expect(nextThemePreference('dim')).toBe('system')
  })
})

describe('prefersDarkScheme', () => {
  it('reads matchMedia when available', () => {
    expect(prefersDarkScheme({ matchMedia: () => ({ matches: true }) })).toBe(true)
    expect(prefersDarkScheme({ matchMedia: () => ({ matches: false }) })).toBe(false)
  })

  it('returns false when matchMedia is unavailable', () => {
    expect(prefersDarkScheme(undefined)).toBe(false)
    expect(prefersDarkScheme({})).toBe(false)
  })
})

describe('inlineThemeAttributeValue', () => {
  it('emits a script that resolves system/light/dim pre-paint', () => {
    const script = inlineThemeAttributeValue()
    expect(script).toContain("localStorage.getItem('genum-theme')")
    expect(script).toContain('prefers-color-scheme: dark')
    expect(script).toContain("setAttribute('data-theme'")
    // Must never throw into page render — wrapped in try/catch.
    expect(script).toContain('catch')
  })
})
