import { expect, test } from "@playwright/test";

test("static survey and admin entry points load", async ({ page }) => {
  await page.route("**/assets/js/config.js", (route) => route.fulfill({
    contentType: "application/javascript",
    body: "window.SURVEY_CONFIG = { supabaseUrl: '', supabaseAnonKey: '' };",
  }));
  await page.goto("/index.html");
  await expect(page).toHaveTitle("Survey for Competition Organizers");
  await expect(page.getByText(/storage is not configured/i)).toBeVisible();

  await page.goto("/admin.html");
  await expect(page).toHaveTitle("Survey Analytics");
  await expect(page.getByText(/analytics service is not configured/i)).toBeVisible();
});
