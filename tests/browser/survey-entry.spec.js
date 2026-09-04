import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.__SURVEY_RUNTIME__ = {
      persistence: {
        async load() {
          return {
            id: "response-1",
            respondent_name: "Jane Li",
            organization: "ABC University",
            answers: { q01: "0", q02: "Yes" },
            version: 1,
            updated_at: "2026-09-04T01:00:00.000Z",
          };
        },
        async save() {
          return { status: "saved", response_version: 2, updated_at: "2026-09-04T02:00:00.000Z" };
        },
      },
    };
  });
});

test("respondent entry validates identity and displays contact information", async ({ page }) => {
  await page.goto("/index.html");

  await expect(page.getByRole("heading", { name: "Survey for Competition Organizers" })).toBeVisible();
  await expect(page.getByRole("link", { name: "hui.song@rmit.edu.au" })).toHaveAttribute("href", "mailto:hui.song@rmit.edu.au");
  await expect(page.getByLabel("Your name")).toHaveAttribute("maxlength", "120");
  await expect(page.getByLabel("Organization")).toHaveAttribute("maxlength", "200");
  await page.getByRole("button", { name: "Continue to survey" }).click();
  await expect(page.getByText("Name is required.")).toBeVisible();
  await expect(page.getByText("Organization is required.")).toBeVisible();

  await page.getByLabel("Your name").fill("Jane Li");
  await page.getByLabel("Organization").fill("ABC University");
  await page.getByLabel(/I understand/).check();
  await page.getByRole("button", { name: "Continue to survey" }).click();

  await expect(page.getByRole("heading", { name: "Basic Information" })).toBeVisible();
  await expect(page.getByText("Existing response loaded")).toBeVisible();
});

test("survey service errors are displayed as text rather than HTML", async ({ page }) => {
  await page.goto("/index.html");
  await page.evaluate(() => {
    window.__SURVEY_RUNTIME__.persistence.load = async () => { throw new Error('<img src=x alt="unsafe">'); };
  });
  await page.getByLabel("Your name").fill("Jane Li");
  await page.getByLabel("Organization").fill("ABC University");
  await page.getByLabel(/I understand/).check();
  await page.getByRole("button", { name: "Continue to survey" }).click();
  await expect(page.getByText('<img src=x alt="unsafe">')).toBeVisible();
  await expect(page.locator("img")).toHaveCount(0);
});
