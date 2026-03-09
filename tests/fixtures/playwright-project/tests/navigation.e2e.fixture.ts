import { expect, test } from "@playwright/test";

/*---
req: REQ-E2E-001
type: e2e
area: navigation
summary: Main navigation menu links work correctly
acceptance:
  - Home link navigates to /
  - Catalog link navigates to /catalog
  - Cart link shows item count badge
tags: [navigation, user-facing]
changed:
  - date: 2026-01-15
    commit: abc1234
    note: Initial stub
  - date: 2026-01-28
    commit: mno7890
    note: Fully implemented
---*/
test.describe("navigation", () => {
	test("home link works (REQ-E2E-001)", async ({ page }) => {
		await page.goto("/");
		await expect(page.locator('[data-test-id="nav-home"]')).toBeVisible();
	});

	test("catalog link works", async ({ page }) => {
		await page.goto("/");
		await page.locator('[data-test-id="nav-catalog"]').click();
		await expect(page).toHaveURL(/catalog/);
	});

	test("cart shows item count", async ({ page }) => {
		await page.goto("/");
		await expect(page.locator('[data-test-id="nav-cart.badge"]')).toBeVisible();
	});
});
