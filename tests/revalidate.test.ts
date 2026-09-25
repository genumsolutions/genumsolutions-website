import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  calls: [] as { path: string; type?: string }[],
  throwNext: false,
}));

vi.mock("next/cache", () => ({
  revalidatePath: (path: string, type?: string) => {
    if (state.throwNext) {
      state.throwNext = false;
      throw new Error("static generation store missing");
    }
    state.calls.push({ path, type });
  },
}));

import {
  revalidateCompany,
  revalidateHomeContent,
  revalidateJournal,
  revalidateProducts,
  revalidatePrograms,
  revalidateServices,
} from "../lib/revalidate";

const paths = () => state.calls.map((c) => c.path);

describe("admin mutation revalidation map", () => {
  beforeEach(() => {
    state.calls.length = 0;
    state.throwNext = false;
  });

  it("product saves bust every surface that renders products", () => {
    revalidateProducts("the-clockwork-cog");
    expect(paths()).toEqual([
      "/",
      "/products",
      "/3d-printing",
      "/projects",
      "/products/the-clockwork-cog",
    ]);
  });

  it("product changes with no id still bust the shared listings", () => {
    revalidateProducts();
    expect(paths()).toEqual(["/", "/products", "/3d-printing", "/projects"]);
  });

  it("service saves bust only /services", () => {
    revalidateServices();
    expect(paths()).toEqual(["/services"]);
  });

  it("program/pilot/curriculum saves bust home and /services", () => {
    revalidatePrograms();
    expect(paths()).toEqual(["/", "/services"]);
  });

  it("homepage content saves bust the home route", () => {
    revalidateHomeContent();
    expect(paths()).toEqual(["/"]);
  });

  it("journal saves bust /journal", () => {
    revalidateJournal();
    expect(paths()).toEqual(["/journal"]);
  });

  it("company info busts the whole layout, not a single path", () => {
    revalidateCompany();
    expect(state.calls).toEqual([{ path: "/", type: "layout" }]);
  });

  it("never revalidates robo_car_modes surfaces (/tools renders static data)", () => {
    revalidateProducts("x");
    revalidateServices();
    revalidatePrograms();
    revalidateHomeContent();
    revalidateJournal();
    revalidateCompany();
    expect(paths()).not.toContain("/tools");
  });

  it("a throwing revalidatePath does not break the caller", () => {
    state.throwNext = true;
    expect(() => revalidateProducts("abc")).not.toThrow();
    state.throwNext = true;
    expect(() => revalidateCompany()).not.toThrow();
    state.throwNext = true;
    expect(() => revalidateServices()).not.toThrow();
  });

  it("keeps going after one path throws, so the rest are still busted", () => {
    state.throwNext = true;
    revalidateProducts("abc");
    expect(paths()).toEqual(["/products", "/3d-printing", "/projects", "/products/abc"]);
  });
});
