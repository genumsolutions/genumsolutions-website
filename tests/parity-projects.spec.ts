// App-vs-website parity: projects listing + a project detail page.
//
// Both read the same catalog through getManagedProducts, and the detail page
// renders the code / 3D material / coding-procedure blocks from the merged
// project details. These keep parity alive across the rollout: if the website
// and app drift on what a "project page" is, these catch it.
import { expect, test } from "@playwright/test";

type CatalogProduct = {
  id: string;
  name: string;
  productType?: string | null;
};

const isProjectPackage = (product: CatalogProduct) =>
  String(product.productType ?? "")
    .trim()
    .toLowerCase() === "project package";

test.describe("projects", () => {
  test("the projects listing shows project packages and a route into the shop", async ({
    page,
  }) => {
    await page.goto("/projects");

    // The page intro and the catalogue's own heading (app/projects/page.tsx).
    await expect(
      page.getByRole("heading", {
        name: /teaching, automation, and robot-car projects\./i,
        level: 1,
      })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /browse what is ready to build/i, level: 2 })
    ).toBeVisible();

    // Route into the IoT controller, and at least one card into a detail page.
    await expect(
      page.getByRole("link", { name: /test & control on the iot controller/i })
    ).toBeVisible();
    await expect(page.locator('a[href^="/products/"]').first()).toBeVisible();
  });

  test.describe("a project detail page", () => {
    test("renders a project package and the project-information card", async ({
      page,
      request,
    }) => {
      // Discover the slug from the same public catalog `/projects` reads, so
      // the test survives catalog renames instead of pinning a made-up URL.
      const response = await request.get("/api/products");
      expect(response.ok(), "the public catalog endpoint responds").toBeTruthy();
      const catalog = (await response.json()) as CatalogProduct[];
      const project = catalog.find(isProjectPackage);
      if (!project) {
        test.skip(true, "the catalog has no project package yet");
        return;
      }

      await page.goto(`/products/${project.id}`);
      await expect(page).toHaveTitle(/GENUM Solutions/i);
      await expect(page.getByText("Product information", { exact: true })).toBeVisible();

      // The project-information card is the public view of the merged project
      // details (columns + import_meta copy).
      const info = page.getByText("Project information", { exact: true });
      await expect(info).toBeVisible();

      // Empty blocks are omitted instead of drawing blank headings, so every
      // block heading that does appear must be followed by content.
      const card = info.locator("xpath=..");
      for (const heading of await card.getByRole("heading", { level: 2 }).all()) {
        await expect(
          heading.locator("xpath=following-sibling::*[1]"),
          `"${await heading.innerText()}" renders without content`
        ).not.toBeEmpty();
      }
    });
  });
});
