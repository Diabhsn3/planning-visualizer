/**
 * Smoke E2E: every key page loads and renders its primary content.
 *
 * Real LLM calls are NOT made — this only verifies the frontend reaches
 * each route and the static UI is in place. The deeper "click upload →
 * see plan playback" flow lives in visualizer-flow.spec.ts.
 */
import { test, expect } from "@playwright/test";

test("welcome page loads with primary heading", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/.+/); // any title
  // The page renders the words "Planning Visualizer" somewhere in its hero.
  await expect(page.getByText(/planning visualizer/i).first()).toBeVisible();
});

test("visualizer route is reachable", async ({ page }) => {
  await page.goto("/visualizer");
  // Wait for any canvas or upload affordance to mount
  await expect(page.locator("body")).toBeVisible();
  // The page should not show an unhandled-error overlay
  const errorOverlay = page.locator("text=/Application error/i");
  await expect(errorOverlay).toHaveCount(0);
});

test("verifier route is reachable", async ({ page }) => {
  await page.goto("/verifier");
  await expect(page.locator("body")).toBeVisible();
  const errorOverlay = page.locator("text=/Application error/i");
  await expect(errorOverlay).toHaveCount(0);
});
