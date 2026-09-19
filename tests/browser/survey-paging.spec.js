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

async function walkToReview(page) {
  for (let guard = 0; guard < 30; guard += 1) {
    const review = page.getByRole("button", { name: "Review answers" });
    if (await review.count()) {
      await review.click();
      return;
    }
    await answerVisibleRequired(page);
    await page.getByRole("button", { name: "Next page" }).click();
  }
  throw new Error("the review step was never reached");
}

test("survey shows at most two choice questions per page", async ({ page }) => {
  await startBlankSurvey(page);

  await expect(page.locator("fieldset.question-card")).toHaveCount(2);
  await expect(page.locator('[data-question-id="q01"]')).toBeVisible();
  await expect(page.locator('[data-question-id="q02"]')).toBeVisible();
  await expect(page.getByRole("button", { name: "Submit now", exact: true })).toHaveCount(0);
  await expect(page.getByText("Page 1 of 18")).toBeVisible();

  await answerVisibleRequired(page);
  await page.getByRole("button", { name: "Next page" }).click();

  await expect(page.locator('[data-question-id="q03"]')).toBeVisible();
  await expect(page.locator('[data-question-id="q04"]')).toBeVisible();
  await expect(page.getByText("Page 2 of 18")).toBeVisible();
});

test("multi-select questions occupy their own page and page numbers jump exactly", async ({ page }) => {
  await startBlankSurvey(page);
  await page.getByRole("button", { name: "Page 3", exact: true }).click();
  await expect(page.locator("fieldset.question-card")).toHaveCount(1);
  await expect(page.locator('[data-question-id="q07"]')).toBeVisible();
  await page.getByRole("button", { name: "Page 13", exact: true }).click();
  await expect(page.locator('[data-question-id="q27"]')).toBeVisible();
  await expect(page.locator(".section-nav")).toHaveCSS("overflow-x", "auto");
  await page.waitForTimeout(50);
  const centered = await page.evaluate(() => {
    const nav = document.querySelector(".section-nav");
    const active = document.querySelector('.page-link.active');
    const centered = Math.max(0, active.offsetLeft - (nav.clientWidth - active.offsetWidth) / 2);
    const expected = Math.min(nav.scrollWidth - nav.clientWidth, centered);
    return Math.abs(nav.scrollLeft - expected) < 3;
  });
  expect(centered).toBe(true);
});

test("open text questions each get their own page", async ({ page }) => {
  await startBlankSurvey(page);
  await page.getByRole("button", { name: "Page 13", exact: true }).click();

  await expect(page.locator("fieldset.question-card")).toHaveCount(1);
  await expect(page.locator('[data-question-id="q27"] textarea')).toBeVisible();

  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.locator("fieldset.question-card")).toHaveCount(1);
  await expect(page.locator('[data-question-id="q28"] textarea')).toBeVisible();
});

test("a page validates only the questions it shows", async ({ page }) => {
  await startBlankSurvey(page);
  await page.getByRole("button", { name: "Next page" }).click();

  await expect(page.getByRole("alert")).toContainText("2 required answers need attention");
  await expect(page.locator('[data-question-id="q03"]')).toHaveCount(0);
  expect(await page.evaluate(() => document.activeElement?.getAttribute("name"))).toBe("q01");
});

test("final review returns to the first page of a section", async ({ page }) => {
  await startBlankSurvey(page);
  await walkToReview(page);

  await expect(page.getByRole("heading", { name: "Review your answers" })).toBeVisible();
  await page.getByRole("button", { name: "Edit Logistical Support" }).click();

  await expect(page.locator('[data-question-id="q18"]')).toBeVisible();
  await expect(page.locator('[data-question-id="q19"]')).toBeVisible();
  await expect(page.getByText("Page 10 of 18")).toBeVisible();

  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.locator('[data-question-id="q16"]')).toBeVisible();
  await expect(page.getByText("Page 9 of 18")).toBeVisible();
});
