import { describe, expect, it } from "vitest";
import {
  DEFAULT_THEME,
  LEGACY_SYSTEM_THEME,
  THEME_STORAGE_KEY,
  applyThemePreference,
  inlineThemeAttributeValue,
  nextThemePreference,
  readStoredPreference,
  writeStoredPreference,
} from "../lib/theme";

function fakeStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
  };
}

describe("readStoredPreference", () => {
  it("defaults to light when storage is empty", () => {
    expect(readStoredPreference(fakeStorage())).toBe("light");
    expect(DEFAULT_THEME).toBe("light");
  });

  it("accepts dim and light", () => {
    expect(readStoredPreference(fakeStorage({ [THEME_STORAGE_KEY]: "dim" }))).toBe("dim");
    expect(readStoredPreference(fakeStorage({ [THEME_STORAGE_KEY]: "light" }))).toBe("light");
  });

  it("migrates the legacy system (OS-follow) value to dim", () => {
    expect(readStoredPreference(fakeStorage({ [THEME_STORAGE_KEY]: "system" }))).toBe("dim");
    expect(LEGACY_SYSTEM_THEME).toBe("dim");
  });

  it("migrates unknown legacy values to light", () => {
    expect(readStoredPreference(fakeStorage({ [THEME_STORAGE_KEY]: "blue" }))).toBe("light");
    expect(readStoredPreference(fakeStorage({ [THEME_STORAGE_KEY]: "dark" }))).toBe("light");
    expect(readStoredPreference(null)).toBe("light");
    expect(
      readStoredPreference({
        getItem: () => {
          throw new Error("denied");
        },
      })
    ).toBe("light");
  });
});

describe("writeStoredPreference", () => {
  it("persists the preference", () => {
    const storage = fakeStorage();
    writeStoredPreference(storage, "dim");
    expect(storage.getItem(THEME_STORAGE_KEY)).toBe("dim");
  });

  it("swallows storage errors (private mode)", () => {
    const throwing = {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota");
      },
    };
    expect(() => writeStoredPreference(throwing as unknown as Storage, "dim")).not.toThrow();
  });
});

describe("applyThemePreference", () => {
  it("sets the data-theme attribute on the document element", () => {
    let last: [string, string] | null = null;
    const element = {
      setAttribute: (name: string, value: string) => {
        last = [name, value];
      },
    };
    const fakeDocument = { documentElement: element as unknown as HTMLElement };
    expect(applyThemePreference("dim", fakeDocument)).toBe("dim");
    expect(last).toEqual(["data-theme", "dim"]);
    applyThemePreference("light", fakeDocument);
    expect(last).toEqual(["data-theme", "light"]);
  });
});

describe("nextThemePreference", () => {
  it("cycles light ⇄ dim", () => {
    expect(nextThemePreference("light")).toBe("dim");
    expect(nextThemePreference("dim")).toBe("light");
  });
});

describe("inlineThemeAttributeValue", () => {
  it("emits a script that resolves light/dim pre-paint — no flash, no OS follow", () => {
    const script = inlineThemeAttributeValue();
    expect(script).toContain("localStorage.getItem('genum-theme')");
    expect(script).toContain("setAttribute('data-theme'");
    // The pre-paint script must never reference the removed system/OS logic.
    expect(script).not.toContain("matchMedia");
    expect(script).not.toContain("prefers-color-scheme");
    // Must never throw into page render — wrapped in try/catch.
    expect(script).toContain("catch");
  });

  it("maps stored dim/light through and migrates system → dim / missing → light", () => {
    const script = inlineThemeAttributeValue();
    expect(script).toContain("'light'");
    expect(script).toContain("'dim'");
    expect(script).toContain("t==='system'?'dim':'light'");
  });
});
