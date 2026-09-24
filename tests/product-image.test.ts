import { describe, expect, it } from "vitest";
import { isStorageImage } from "../lib/product-image";

// W1 (2026-09-24): link-import image parity. The admin PUT route converts
// foreign image URLs to product-images storage URLs via the edge fn; these
// tests pin the pass-through gate so re-saving a fixed row never re-downloads
// and foreign hosts are never trusted.
describe("isStorageImage (W1 image conversion gate)", () => {
  it("accepts the shared Supabase product-images bucket URLs", () => {
    expect(
      isStorageImage(
        "https://bkylfnlybtsujwzropru.supabase.co/storage/v1/object/public/product-images/abc-model.png"
      )
    ).toBe(true);
  });

  it("rejects foreign CDNs (the link-import bug: makerworld/shop images)", () => {
    expect(isStorageImage("https://makerworld.com/en/models/cover.webp")).toBe(false);
    expect(isStorageImage("https://images.unsplash.com/photo-123?w=600")).toBe(false);
    expect(isStorageImage("https://evil.example.com/storage/v1/object/public/x.png")).toBe(false);
  });

  it("rejects lookalikes: wrong path, http downgrade, non-supabase host", () => {
    expect(isStorageImage("https://bkylfnlybtsujwzropru.supabase.co/not-storage/file.png")).toBe(
      false
    );
    expect(
      isStorageImage("http://bkylfnlybtsujwzropru.supabase.co/storage/v1/object/public/a.png")
    ).toBe(false);
    expect(isStorageImage("https://supabase.co.evil.test/storage/v1/object/public/a.png")).toBe(
      false
    );
  });

  it("rejects empty, relative, and malformed values", () => {
    expect(isStorageImage("")).toBe(false);
    expect(isStorageImage("   ")).toBe(false);
    expect(isStorageImage("/media/products/arduino-uno.jpg")).toBe(false);
    expect(isStorageImage("not a url")).toBe(false);
  });
});
