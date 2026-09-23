import { describe, expect, it } from "vitest";
import { androidApp, appInfoFromManifest, sizeLabelFromManifest } from "../lib/company";

// The /app download section must show exactly what is actually downloadable.
// The live release.json manifest is the single source of truth — it is only
// written after a real APK upload — so the site never advertises a version
// whose build isn't ready yet.
describe("sizeLabelFromManifest", () => {
  it("derives the label from the exact size_bytes in decimal MB", () => {
    expect(sizeLabelFromManifest({ size_bytes: 37759954 })).toBe("37.8 MB");
  });

  it("prefers size_bytes over a stale/mismatched sizeLabel (matches real download)", () => {
    expect(sizeLabelFromManifest({ sizeLabel: "36 MB", size_mb: 36, size_bytes: 37759954 })).toBe(
      "37.8 MB"
    );
  });

  it("uses sizeLabel as a fallback when size_bytes is missing", () => {
    expect(sizeLabelFromManifest({ sizeLabel: "37.8 MB" })).toBe("37.8 MB");
  });

  it("formats size_mb to one decimal when size_bytes and sizeLabel are missing", () => {
    expect(sizeLabelFromManifest({ size_mb: 37.8 })).toBe("37.8 MB");
  });

  it("uses the legacy plain size string as a last resort", () => {
    expect(sizeLabelFromManifest({ size: "35.1 MB" })).toBe("35.1 MB");
  });

  it("ignores zero / empty sizes", () => {
    expect(sizeLabelFromManifest({ sizeLabel: "0" })).toBeUndefined();
    expect(sizeLabelFromManifest({ size_mb: 0 })).toBeUndefined();
    expect(sizeLabelFromManifest({ size_bytes: 0 })).toBeUndefined();
    expect(sizeLabelFromManifest({ size: "" })).toBeUndefined();
    expect(sizeLabelFromManifest({})).toBeUndefined();
  });
});

describe("appInfoFromManifest", () => {
  it("maps the manifest fields onto AppInfo", () => {
    const info = appInfoFromManifest({
      version: "1.6.3",
      version_code: 32,
      size_mb: 36,
      size_bytes: 37759954,
      apkUrl: "https://bucket/genum-solutions-1.6.3.apk",
      latestApkUrl: "https://bucket/genum-solutions-latest.apk",
      releaseUrl: "https://bucket/release.json",
      appsPagePath: "/app",
    });
    expect(info).toEqual({
      version: "1.6.3",
      versionCode: 32,
      sizeLabel: "37.8 MB",
      apkUrl: "https://bucket/genum-solutions-1.6.3.apk",
      latestApkUrl: "https://bucket/genum-solutions-latest.apk",
      releaseUrl: "https://bucket/release.json",
      appsPagePath: "/app",
    });
  });

  it("omits fields that are missing from the manifest", () => {
    expect(appInfoFromManifest({ version: "1.6.2" })).toEqual({ version: "1.6.2" });
  });

  it("ignores empty / non-numeric fields", () => {
    expect(appInfoFromManifest({ version: "", version_code: NaN, apkUrl: "" })).toEqual({});
  });
});

describe("androidApp fallback shape (guard against sync-app-fallback corruption)", () => {
  // A 2026-09-18 incident: sync-app-fallback.mjs regexes compounded a comma /
  // quote on every run, corrupting this block ('3.2.0',, / '34.5 MB',','), which
  // broke typecheck and CI until repaired. This guard makes any future malformed
  // fallback fail the test suite loudly at the value level.
  it("carries a well-formed semver version", () => {
    expect(androidApp.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("carries a positive integer versionCode", () => {
    expect(Number.isInteger(androidApp.versionCode)).toBe(true);
    expect(androidApp.versionCode).toBeGreaterThan(0);
  });

  it("carries a size label ending in MB", () => {
    expect(androidApp.sizeLabel).toMatch(/^[\d.]+ MB$/);
  });

  it("carries a non-empty arch", () => {
    expect(androidApp.arch.length).toBeGreaterThan(0);
  });

  it("points all download URLs at the shared app-releases bucket", () => {
    for (const url of [androidApp.apkUrl, androidApp.latestApkUrl, androidApp.releaseUrl]) {
      expect(url.startsWith("https://")).toBe(true);
      expect(url).toContain("/storage/v1/object/public/app-releases/");
    }
  });
});
