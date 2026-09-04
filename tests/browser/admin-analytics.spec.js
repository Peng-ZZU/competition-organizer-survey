import { expect, test } from "@playwright/test";

const responses = [
  { id: "1", respondent_name: "Jane Li", organization: "ABC University", normalized_organization: "abc university", answers: { q02: "Yes", q03: "10+", q07: ["Academic", "Industry"] }, created_at: "2026-09-01T01:00:00Z", updated_at: "2026-09-02T01:00:00Z" },
  { id: "2", respondent_name: "Alex Chen", organization: "ABC University", normalized_organization: "abc university", answers: { q02: "No", q03: "5-9", q07: ["Industry"] }, created_at: "2026-09-01T02:00:00Z", updated_at: "2026-09-02T02:00:00Z" },
  { id: "3", respondent_name: "Maria Smith", organization: "XYZ Institute", normalized_organization: "xyz institute", answers: { q02: "Yes", q03: "10+", q07: ["Academic", "Industry"] }, created_at: "2026-09-01T03:00:00Z", updated_at: "2026-09-02T03:00:00Z" },
];

async function installRuntime(page, data) {
  await page.addInitScript((responseData) => {
    window.__ADMIN_RUNTIME__ = {
      auth: {
        async getSession() { return { user: { email: "admin@example.com" } }; },
        async signIn() { return { user: { email: "admin@example.com" } }; },
        async signOut() {},
        onAuthStateChange() { return () => {}; },
      },
      data: { async loadResponses() { return responseData; } },
    };
  }, data);
}

test("overview and choice views show counts and percentages", async ({ page }) => {
  await installRuntime(page, responses);
  await page.goto("/admin.html");
  await expect(page.getByText("Completed Responses")).toBeVisible();
  await expect(page.getByTestId("completed-responses")).toHaveText("3");
  await expect(page.getByTestId("organizations-represented")).toHaveText("2");
  await expect(page.getByTestId("plan-to-run-again")).toHaveText("66.7%");

  await page.getByRole("button", { name: "Choice Questions" }).click();
  const chart = page.locator('[data-chart-question="q03"]');
  await expect(chart).toContainText("How many submissions did your competition receive?");
  await expect(chart).toContainText("10+");
  await expect(chart).toContainText("2 · 66.7%");
  await expect(chart.locator("canvas")).toHaveCount(1);
});

test("empty analytics state is explicit", async ({ page }) => {
  await installRuntime(page, []);
  await page.goto("/admin.html");
  await page.getByRole("button", { name: "Choice Questions" }).click();
  await expect(page.getByText("No responses yet").first()).toBeVisible();
});

test("analytics dashboard fits a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installRuntime(page, responses);
  await page.goto("/admin.html");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
