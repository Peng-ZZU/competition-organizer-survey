import { expect, test } from "@playwright/test";

test("administrator downloads the complete CSV export", async ({ page }) => {
  await page.addInitScript(() => {
    window.__ADMIN_RUNTIME__ = {
      auth: {
        async getSession() { return { user: { email: "admin@example.com" } }; },
        async signOut() {},
        onAuthStateChange() { return () => {}; },
      },
      data: {
        async loadResponses() {
          return [{ respondent_name: "Jane Li", organization: "ABC University", answers: { q01: "0" }, created_at: "2026-09-01T01:00:00Z", updated_at: "2026-09-02T01:00:00Z" }];
        },
      },
    };
  });
  await page.goto("/admin.html");
  await page.getByRole("button", { name: "Export" }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download CSV" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^competition-organizer-survey-\d{4}-\d{2}-\d{2}\.csv$/);
});
