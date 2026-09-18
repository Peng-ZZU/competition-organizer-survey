import { expect, test } from "@playwright/test";

async function startBlankSurvey(page) {
  await page.addInitScript(() => {
    window.__SURVEY_RUNTIME__ = {
      persistence: {
        async load() { return null; },
        async save() { return { status: "saved", response_version: 1 }; },
      },
    };
  });
  await page.goto("/index.html");
  await page.getByLabel("Your name").fill("Jane Li");
  await page.getByLabel("Organization").fill("ABC University");
  await page.getByLabel(/I understand/).check();
  await page.getByRole("button", { name: "Continue to survey" }).click();
}

async function answerVisibleRequired(page) {
  const fieldsets = page.locator("fieldset.question-card");
  for (let index = 0; index < await fieldsets.count(); index += 1) {
    const fieldset = fieldsets.nth(index);
    if (!await fieldset.getByText("Required", { exact: true }).count()) continue;
    const textarea = fieldset.locator("textarea");
    if (await textarea.count()) {
      await textarea.fill("Required detail");
      continue;
    }
    const radios = fieldset.locator('input[type="radio"]');
    if (await radios.count()) {
      await radios.last().check();
      continue;
    }
    const checkboxes = fieldset.locator('input[type="checkbox"]');
    if (await checkboxes.count()) await checkboxes.first().check();
  }
}

test("section navigation validates, reviews, and returns without losing answers", async ({ page }) => {
  await startBlankSurvey(page);

  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.getByRole("alert")).toContainText("2 required answers need attention");
  await expect(page.getByRole("alert").getByRole("link").first()).toHaveAttribute("href", "#q01-field");
  await expect(page.locator('[name="q01"]').first()).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator('[name="q01"]').first()).toHaveAttribute("aria-describedby", "q01-error");
  await expect(page.locator("#q01-error")).toContainText("This question is required.");
  assertActiveName: {
    const activeName = await page.evaluate(() => document.activeElement?.getAttribute("name"));
    expect(activeName).toBe("q01");
  }

  for (let index = 0; index < 17; index += 1) {
    await answerVisibleRequired(page);
    await page.getByRole("button", { name: "Next page" }).click();
  }
  await page.getByRole("button", { name: "Review answers" }).click();

  await expect(page.getByRole("heading", { name: "Review your answers" })).toBeVisible();
  await expect(page.getByText("Jane Li")).toBeVisible();
  await page.getByRole("button", { name: "Edit Basic Information" }).click();
  await expect(page.getByRole("heading", { name: "Basic Information" })).toBeVisible();
  await expect(page.locator('[data-question-id="q01"] input:checked')).toHaveValue("3+");
});
