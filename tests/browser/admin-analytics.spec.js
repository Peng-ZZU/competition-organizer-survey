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
  await expect(chart).toContainText(/2\s*[^0-9\s]\s*66\.7%/);
  await expect(chart.locator("canvas")).toHaveCount(1);
});

test("empty analytics state is explicit", async ({ page }) => {
  await installRuntime(page, []);
  await page.goto("/admin.html");
  await page.getByRole("button", { name: "Choice Questions" }).click();
  await expect(page.getByText("No responses yet").first()).toBeVisible();
});

for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 768, height: 1024 }]) {
test(`analytics dashboard stays usable within a ${viewport.width}px viewport`, async ({ page }) => {
  await page.setViewportSize(viewport);
  await installRuntime(page, responses);
  await page.goto("/admin.html");

  await expect(page.getByRole("heading", { name: "Survey Analytics" })).toBeVisible();
  const overviewNav = page.getByRole("button", { name: /Overview/ });
  await expect(overviewNav).toBeVisible();
  await expect(page.getByText("Completed Responses")).toBeVisible();
  await expect(page.locator(".metric-grid")).toBeVisible();

  for (const locator of [page.locator(".admin-sidebar"), overviewNav, page.locator(".metric-grid"), page.locator(".dashboard-panel")]) {
    const box = await locator.boundingBox();
    expect(box, "element should be laid out").not.toBeNull();
    expect(box.x).toBeGreaterThanOrEqual(-1);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
  }

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);

  await page.getByRole("button", { name: "Respondents" }).click();
  await expect(page.getByRole("heading", { name: "Respondents" })).toBeVisible();
  await expect(page.locator(".respondent-row").first()).toBeVisible();
  const rowOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(rowOverflow).toBeLessThanOrEqual(1);
});
}
