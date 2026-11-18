import { defineConfig } from "@playwright/test";

// App-vs-website parity specs (tests/*.spec.ts). They run against a running
// site: set WEBSITE_URL to point at a deployment, or leave it unset and the
// config boots one on port 3000 itself — `npm run start` in CI (the ci.yml
// job builds first, so the suite checks the shipped build) and `npm run dev`
// locally. It uses localhost (not 127.0.0.1) so `next dev` does not block its
// own HMR origin.
const baseURL = process.env.WEBSITE_URL || "http://localhost:3000";

export default defineConfig({
  testDir: "./tests",
  // Vitest owns `*.test.ts` (see vitest.config.mts); Playwright owns `*.spec.ts`.
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  webServer: process.env.WEBSITE_URL
    ? undefined
    : {
        command: process.env.CI ? "npm run start" : "npm run dev",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
});
