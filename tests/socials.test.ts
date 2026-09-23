import { describe, expect, it } from "vitest";
import {
  isValidWhatsappNumber,
  normalizeWhatsappNumber,
  socialLinks,
  whatsappLink,
} from "../lib/socials";
import { company } from "../lib/company";

// C5 (2026-09-23): socials + WhatsApp helpers. The read surfaces (footer,
// contact, checkout-success) are covered by build + the live probe; these
// tests pin the link-building and normalization rules.
describe("socials (C5)", () => {
  it("hides surfaces with empty URLs", () => {
    const links = socialLinks({
      facebookUrl: "https://facebook.com/genum",
      instagramUrl: "",
      tiktokUrl: "  ",
      linkedinUrl: "https://linkedin.com/company/genum",
      youtubeUrl: "",
    });
    expect(links.map((l) => l.key)).toEqual(["facebook", "linkedin"]);
  });

  it("returns nothing when no URL is set", () => {
    expect(
      socialLinks({
        facebookUrl: "",
        instagramUrl: "",
        tiktokUrl: "",
        linkedinUrl: "",
        youtubeUrl: "",
      })
    ).toEqual([]);
  });

  it("normalizes WhatsApp numbers to digits only", () => {
    expect(normalizeWhatsappNumber("+977 986-1842 552")).toBe("9779861842552");
    expect(normalizeWhatsappNumber("9779861842552")).toBe("9779861842552");
    expect(normalizeWhatsappNumber("")).toBe("");
  });

  it("validates the stored number shape (8-15 digits)", () => {
    expect(isValidWhatsappNumber("9779861842552")).toBe(true);
    expect(isValidWhatsappNumber("1234567")).toBe(false);
    expect(isValidWhatsappNumber("not-a-number")).toBe(false);
  });

  it("builds wa.me links with an optional prefilled message", () => {
    expect(whatsappLink("9779861842552")).toBe("https://wa.me/9779861842552");
    expect(whatsappLink("+977 9861842552", "Hi there!")).toBe(
      "https://wa.me/9779861842552?text=Hi%20there!"
    );
    expect(whatsappLink("")).toBe("");
  });

  it("bundled defaults carry placeholder socials (owner fills them later)", () => {
    expect(company.whatsappNumber).toBeTruthy();
    expect(company.facebookUrl).toBe("");
    expect(company.instagramUrl).toBe("");
    expect(company.tiktokUrl).toBe("");
    expect(company.linkedinUrl).toBe("");
    expect(company.youtubeUrl).toBe("");
  });
});
