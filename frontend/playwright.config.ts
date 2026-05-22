import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for the planning-visualizer frontend.
 *
 * Run locally:   pnpm test:e2e
 * Run with UI:   pnpm test:e2e:ui
 *
 * Requires:
 *  - Backend running on http://localhost:4000 (or VITE_API_URL)
 *  - Frontend dev server (vite) on http://localhost:3000 — the webServer
 *    block boots it automatically.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false, // backend has shared state; keep serial
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ["list"],
    ["html", { outputFolder: "../reports/playwright", open: "never" }],
    ["json", { outputFile: "../reports/playwright.json" }],
  ],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: process.env.E2E_NO_WEBSERVER
    ? undefined
    : {
        command: "pnpm dev",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
});
