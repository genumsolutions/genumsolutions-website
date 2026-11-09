import { describe, expect, it } from "vitest";

import {
  extractObjectPaths,
  normalizeObjectPath,
  planSweep,
  summarizeKept,
  type SweepObject,
} from "../lib/image-sweep";

// GC-1 (2026-11-09): the sweep deletes files, so a false "unused" breaks a live
// product page. These tests pin the keep rules and the path extraction that
// feeds them.
const BUCKET = "product-images";

const object = (name: string, size = 1024, lastModified?: string): SweepObject => ({
  name,
  size,
  lastModified: lastModified ?? "2026-01-01T00:00:00.000Z",
});

describe("extractObjectPaths", () => {
  it("reads public URLs, relative paths and nested folders", () => {
    const text = JSON.stringify({
      image_url:
        "https://jxgmbodzkmxanuwfaqxo.supabase.co/storage/v1/object/public/product-images/a.webp",
      gallery: ["/product-images/folder/b%20c.png"],
    });
    expect(extractObjectPaths(text, BUCKET).sort()).toEqual(["a.webp", "folder/b c.png"]);
  });

  it("drops query strings, fragments and sentence punctuation", () => {
    const text =
      'see https://x.supabase.co/storage/v1/object/public/product-images/a.webp?v=2#top "and" product-images/b.png.';
    expect(extractObjectPaths(text, BUCKET).sort()).toEqual(["a.webp", "b.png."]);
  });

  it("ignores text that does not mention the bucket, and lookalike buckets", () => {
    expect(extractObjectPaths('{"x":"product-images-archive/a.png"}', BUCKET)).toEqual([]);
    expect(extractObjectPaths('{"x":"unrelated"}', BUCKET)).toEqual([]);
  });

  it("dedupes repeats of the same object", () => {
    const text = "product-images/a.webp product-images/a.webp";
    expect(extractObjectPaths(text, BUCKET)).toEqual(["a.webp"]);
  });
});

describe("normalizeObjectPath", () => {
  it("strips leading slashes and decodes escapes, surviving bad input", () => {
    expect(normalizeObjectPath("/a%20b.webp")).toBe("a b.webp");
    expect(normalizeObjectPath("a%ZZ.webp")).toBe("a%ZZ.webp");
  });
});

describe("planSweep", () => {
  it("only proposes objects nothing references", () => {
    const plan = planSweep({
      objects: [object("used.webp"), object("orphan.webp", 2048)],
      referencedPaths: ["used.webp"],
      keepHours: 0,
    });
    expect(plan.unused.map((o) => o.name)).toEqual(["orphan.webp"]);
    expect(plan.reclaimableBytes).toBe(2048);
  });

  it("keeps a file whose bare name appears in a row without the bucket path", () => {
    const plan = planSweep({
      objects: [object("arduino-mega.webp")],
      referencedPaths: [],
      haystack: ['{"note":"hero uses arduino-mega.webp"}'],
      keepHours: 0,
    });
    expect(plan.unused).toEqual([]);
    expect(plan.kept[0]?.reason).toBe("referenced-by-name");
  });

  it("keeps objects inside the grace window so an in-flight import survives", () => {
    const now = Date.parse("2026-11-09T12:00:00.000Z");
    const plan = planSweep({
      objects: [
        object("fresh.webp", 100, "2026-11-09T11:00:00.000Z"),
        object("old.webp", 100, "2026-11-01T11:00:00.000Z"),
      ],
      referencedPaths: [],
      keepHours: 24,
      now,
    });
    expect(plan.unused.map((o) => o.name)).toEqual(["old.webp"]);
    expect(plan.kept[0]?.reason).toBe("recent");
  });

  it("treats objects without a timestamp as old enough (listing gaps must not block cleanup)", () => {
    const plan = planSweep({
      objects: [object("no-date.webp", 10, "not a date")],
      referencedPaths: [],
      keepHours: 24,
    });
    expect(plan.unused.map((o) => o.name)).toEqual(["no-date.webp"]);
  });

  it("never proposes a protected placeholder", () => {
    const plan = planSweep({
      objects: [object("genum-product-placeholder.webp")],
      referencedPaths: [],
      protect: ["genum-product-placeholder.webp"],
      keepHours: 0,
    });
    expect(plan.unused).toEqual([]);
    expect(plan.kept[0]?.reason).toBe("protected");
  });

  it("matches references that were percent-encoded differently", () => {
    const plan = planSweep({
      objects: [object("folder/a b.webp")],
      referencedPaths: ["folder/a%20b.webp"],
      keepHours: 0,
    });
    expect(plan.unused).toEqual([]);
  });

  it("summarizes kept reasons", () => {
    const plan = planSweep({
      objects: [object("used.webp"), object("named.webp")],
      referencedPaths: ["used.webp"],
      haystack: ["named.webp"],
      keepHours: 0,
    });
    expect(summarizeKept(plan.kept)).toEqual({
      protected: 0,
      referenced: 1,
      "referenced-by-name": 1,
      recent: 0,
    });
  });
});
