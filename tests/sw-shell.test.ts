import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// =====================================================================
// Service worker shell guard.
//
// History: sw.js v2 listed /tools TWICE in APP_SHELL — Cache.addAll()
// throws on duplicate URLs, so install always rejected and the worker
// NEVER activated in any browser (push + offline shell silently dead on
// production until 2026-09-21). These checks make that class of bug
// impossible to ship again.
// =====================================================================

function readSwSource(): string {
  return readFileSync(join(process.cwd(), "public", "sw.js"), "utf8");
}

function extractAppShell(source: string): string[] {
  const match = source.match(/const APP_SHELL = \[([\s\S]*?)\]/);
  if (!match) throw new Error("APP_SHELL not found in public/sw.js");
  const shellBody = match[1];
  if (shellBody === undefined) throw new Error("APP_SHELL capture group missing");
  // Resolve constants referenced inside the shell (e.g. OFFLINE_URL).
  // Quote-agnostic: prettier (pre-commit) may render sw.js strings with
  // single OR double quotes — accept both (2026-09-23 sweep).
  const constants = new Map<string, string>();
  for (const m of source.matchAll(/const (\w+) = (["'])([^"']+)\2/g)) {
    if (m[1] !== undefined && m[3] !== undefined) constants.set(m[1], m[3]);
  }
  const raw = [...shellBody.matchAll(/["']([^"']+)["']|(\b[A-Z_]+\b)/g)]
    .map((m): string | undefined => m[1] ?? (m[2] !== undefined ? constants.get(m[2]) : undefined))
    .filter((url): url is string => typeof url === "string" && url.startsWith("/"));
  return raw;
}

describe("service worker precache shell (public/sw.js)", () => {
  it("has no duplicate entries (Cache.addAll throws on duplicates)", () => {
    const shell = extractAppShell(readSwSource());
    const dupes = shell.filter((url, i) => shell.indexOf(url) !== i);
    expect(dupes, `duplicate APP_SHELL entries: ${dupes.join(", ")}`).toEqual([]);
  });

  it("keeps every entry a root-relative path on this origin", () => {
    for (const url of extractAppShell(readSwSource())) {
      expect(url.startsWith("/"), `APP_SHELL entry must be root-relative: ${url}`).toBe(true);
    }
  });

  it("includes the offline fallback and push notification icons", () => {
    const shell = extractAppShell(readSwSource());
    expect(shell).toContain("/offline");
    expect(shell).toContain("/icon-192.png");
  });

  it("precache failures cannot reject the whole install", () => {
    const source = readSwSource();
    expect(source).toMatch(/Promise\.allSettled/);
    expect(source).not.toMatch(/cache\.addAll\(/);
  });

  it("broadcasts PUSH_RECEIVED so open pages can react to pushes", () => {
    expect(readSwSource()).toMatch(/PUSH_RECEIVED/);
  });
});
