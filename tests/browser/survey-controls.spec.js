import { expect, test } from "@playwright/test";
import { questions } from "../../assets/js/questions.js";

function completeAnswers() {
  const answers = {};
  for (const question of questions) {
    if (question.condition) continue;
    if (question.type === "multi") answers[question.id] = [question.options[0]];
    else if (question.type === "text") answers[question.id] = "Example answer";
    else answers[question.id] = question.options[0];
  }
  answers.q06 = "Public web page";
  answers.q17 = "Conference presentation";
  answers.q26 = "Used in research";
  return answers;
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript((answers) => {
    window.__SURVEY_RUNTIME__ = {
      persistence: {
        async load() {
          return {
            id: "response-1",
            respondent_name: "Jane Li",
            organization: "ABC University",
            answers,
            version: 1,
            updated_at: "2026-09-04T01:00:00.000Z",
          };
        },
        async save() { return { status: "saved", response_version: 2 }; },
      },
    };
  }, completeAnswers());
  await page.goto("/index.html");
  await page.getByLabel("Your name").fill("Jane Li");
  await page.getByLabel("Organization").fill("ABC University");
  await page.getByLabel(/I understand/).check();
  await page.getByRole("button", { name: "Continue to survey" }).click();
});

test("catalog-driven controls handle current input types and conditional Other details", async ({ page }) => {
  const q01 = page.locator('[data-question-id="q01"]');
  await expect(q01.getByLabel("0")).toBeChecked();

  await page.getByRole("button", { name: "Competition Statistics" }).click();
  const q03 = page.locator('[data-question-id="q03"]');
  await q03.getByLabel("1-4", { exact: true }).check();
  expect(await page.evaluate(() => [document.activeElement?.getAttribute("name"), document.activeElement?.getAttribute("value")])).toEqual(["q03", "1-4"]);
  await expect(page.locator('[data-question-id="q05"]')).toHaveCount(0);
  await expect(page.locator('[data-question-id="q06"]')).toHaveCount(0);

  await page.getByRole("button", { name: "Participant Demographics" }).click();
  const q07 = page.locator('[data-question-id="q07"]');
  await q07.getByLabel("Other", { exact: true }).check();
  await expect(page.getByLabel("Please describe your Other selection for question 5")).toBeVisible();
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.getByRole("alert").getByRole("link").first()).toHaveAttribute("href", "#q07-field");
  await q07.getByLabel("Other", { exact: true }).uncheck();
  await expect(page.getByLabel("Please describe your Other selection for question 5")).toHaveCount(0);

  await page.getByRole("button", { name: "Logistical Support" }).click();
  await expect(page.locator('[data-question-id="q18"]').getByLabel("3")).toBeVisible();

  await page.getByRole("button", { name: "Feedback and Suggestions" }).click();
  await expect(page.locator('[data-question-id="q27"] textarea')).toBeVisible();
});
