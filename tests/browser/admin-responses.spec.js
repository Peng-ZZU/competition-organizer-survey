import { expect, test } from "@playwright/test";

const responses = [
  { id: "1", respondent_name: "Jane Li", organization: "ABC University", normalized_organization: "abc university", answers: { q02: "Yes", q07: ["Academic", "Other"], q07_other: "Researchers", q27: "Strong community" }, version: 2, created_at: "2026-09-01T01:00:00Z", updated_at: "2026-09-02T01:00:00Z" },
  { id: "2", respondent_name: "Alex Chen", organization: "XYZ Institute", normalized_organization: "xyz institute", answers: { q02: "No", q28: "Earlier publicity" }, version: 1, created_at: "2026-09-01T02:00:00Z", updated_at: "2026-09-03T02:00:00Z" },
];

test.beforeEach(async ({ page }) => {
  await page.addInitScript((responseData) => {
    window.__ADMIN_RUNTIME__ = {
      auth: {
        async getSession() { return { user: { email: "admin@example.com" } }; },
        async signOut() {},
        onAuthStateChange() { return () => {}; },
      },
      data: { async loadResponses() { return responseData; } },
    };
  }, responses);
  await page.goto("/admin.html");
});

test("open responses can be searched with respondent attribution", async ({ page }) => {
  await page.getByRole("button", { name: "Open Responses" }).click();
  await expect(page.getByText("ABC University · Jane Li").first()).toBeVisible();
  await expect(page.getByText("Strong community")).toBeVisible();
  await page.getByLabel("Search open responses").fill("XYZ");
  await expect(page.getByText("ABC University · Jane Li")).toHaveCount(0);
  await expect(page.getByText("XYZ Institute · Alex Chen")).toBeVisible();
});

test("respondent detail is read-only and includes timestamps", async ({ page }) => {
  await page.getByRole("button", { name: "Respondents" }).click();
  await expect(page.getByText("Jane Li")).toBeVisible();
  const row = page.locator(".respondent-row").filter({ hasText: "Jane Li" });
  await expect(row).toContainText("Created");
  await expect(row).toContainText("Last updated");
  await page.getByRole("button", { name: "View response for Jane Li" }).click();
  const detail = page.getByRole("dialog", { name: "Response from Jane Li" });
  await expect(page.getByRole("button", { name: "Close" })).toBeFocused();
  await expect(detail).toContainText("Created");
  await expect(detail).toContainText("Last updated");
  await expect(detail).toContainText("Researchers");
  await expect(detail.locator("input, textarea, select")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(detail).toHaveCount(0);
  await expect(page.getByRole("button", { name: "View response for Jane Li" })).toBeFocused();
});

for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 768, height: 1024 }]) {
test(`response dialog fits a ${viewport.width}px viewport`, async ({ page }) => {
  await page.setViewportSize(viewport);
  await page.getByRole("button", { name: "Respondents" }).click();

  const opener = page.getByRole("button", { name: "View response for Jane Li" });
  await opener.click();

  const dialog = page.getByRole("dialog", { name: "Response from Jane Li" });
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox();
  expect(box).not.toBeNull();
  expect(box.x).toBeGreaterThanOrEqual(-1);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(box.height).toBeLessThanOrEqual(viewport.height + 1);

  const close = page.getByRole("button", { name: "Close" });
  await expect(close).toBeVisible();
  const closeBox = await close.boundingBox();
  expect(closeBox.x).toBeGreaterThanOrEqual(-1);
  expect(closeBox.x + closeBox.width).toBeLessThanOrEqual(viewport.width + 1);

  const pageOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(pageOverflow).toBeLessThanOrEqual(1);

  await close.click();
  await expect(dialog).toHaveCount(0);
});
}
