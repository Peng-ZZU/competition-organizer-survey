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
  answers.q06 = "Public list";
  answers.q07 = ["Academic", "Other"];
  answers.q07_other = "Researchers";
  answers.q17 = "Public presentation";
  answers.q26 = "Used in research";
  return answers;
}

async function enterExistingSurvey(page, behavior = "saved") {
  await page.addInitScript(({ answers, behavior }) => {
    let saveAttempt = 0;
    let loadAttempt = 0;
    window.__SURVEY_RUNTIME__ = {
      persistence: {
        async load() {
          loadAttempt += 1;
          return {
            id: "response-1",
            respondent_name: "Jane Li",
            organization: "ABC University",
            answers: loadAttempt > 1 ? { ...answers, q02: "No" } : answers,
            version: loadAttempt > 1 ? 3 : 1,
            updated_at: loadAttempt > 1 ? "2026-09-04T03:00:00.000Z" : "2026-09-04T01:00:00.000Z",
          };
        },
        async save() {
          saveAttempt += 1;
          if (behavior === "retry" && saveAttempt === 1) throw new Error("offline");
          if (behavior === "conflict") return { status: "conflict", response_version: 3 };
          return { status: "saved", response_version: 2, updated_at: "2026-09-04T02:00:00.000Z" };
        },
      },
    };
  }, { answers: completeAnswers(), behavior });
  await page.goto("/index.html");
  await page.getByLabel("Your name").fill("Jane Li");
  await page.getByLabel("Organization").fill("ABC University");
  await page.getByLabel(/I understand/).check();
  await page.getByRole("button", { name: "Continue to survey" }).click();
  await page.getByRole("button", { name: "Feedback and Suggestions" }).click();
  await page.getByRole("button", { name: "Review answers" }).click();
}

test("successful submission shows confirmed save time", async ({ page }) => {
  await enterExistingSurvey(page);
  await expect(page.getByText("Researchers")).toBeVisible();
  await page.getByRole("button", { name: "Submit response" }).click();
  await expect(page.getByRole("heading", { name: "Response saved" })).toBeVisible();
  await expect(page.getByText(/September|2026/)).toBeVisible();
});

test("failed submission preserves answers and can be retried", async ({ page }) => {
  await enterExistingSurvey(page, "retry");
  await page.getByRole("button", { name: "Submit response" }).click();
  await expect(page.getByRole("alert")).toContainText("Your response was not saved");
  await page.getByRole("button", { name: "Retry submission" }).click();
  await expect(page.getByRole("heading", { name: "Response saved" })).toBeVisible();
});

test("conflict blocks overwrite and reloads the latest response", async ({ page }) => {
  await enterExistingSurvey(page, "conflict");
  await page.getByRole("button", { name: "Submit response" }).click();
  await expect(page.getByRole("alert")).toContainText("updated somewhere else");
  await page.getByRole("button", { name: "Reload latest response" }).click();
  await expect(page.getByText("Latest response loaded")).toBeVisible();
});

test("final submission returns a missing Other detail to its parent question", async ({ page }) => {
  const answers = completeAnswers();
  delete answers.q07_other;
  await page.addInitScript((responseAnswers) => {
    window.__SURVEY_RUNTIME__ = {
      persistence: {
        async load() { return { id: "response-1", answers: responseAnswers, version: 1, updated_at: "2026-09-04T01:00:00.000Z" }; },
        async save() { throw new Error("save must not run"); },
      },
    };
  }, answers);
  await page.goto("/index.html");
  await page.getByLabel("Your name").fill("Jane Li");
  await page.getByLabel("Organization").fill("ABC University");
  await page.getByLabel(/I understand/).check();
  await page.getByRole("button", { name: "Continue to survey" }).click();
  await page.getByRole("button", { name: "Feedback and Suggestions" }).click();
  await page.getByRole("button", { name: "Review answers" }).click();
  await page.getByRole("button", { name: "Submit response" }).click();
  await expect(page.getByRole("heading", { name: "Participant Demographics" })).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("Please describe your Other selection");
  await expect(page.getByLabel("Please describe your Other selection for question 7")).toBeFocused();
});

test("unsaved local draft restores for the same respondent", async ({ page }) => {
  await page.addInitScript(() => {
    window.__SURVEY_RUNTIME__ = { persistence: { async load() { return null; }, async save() { return { status: "saved" }; } } };
  });
  await page.goto("/index.html");
  await page.getByLabel("Your name").fill("Jane Li");
  await page.getByLabel("Organization").fill("ABC University");
  await page.getByLabel(/I understand/).check();
  await page.getByRole("button", { name: "Continue to survey" }).click();
  await page.locator('[data-question-id="q01"]').getByLabel("1-2").check();
  await page.reload();
  await page.getByLabel("Your name").fill("Jane Li");
  await page.getByLabel("Organization").fill("ABC University");
  await page.getByLabel(/I understand/).check();
  await page.getByRole("button", { name: "Continue to survey" }).click();
  await expect(page.getByText("Local draft restored")).toBeVisible();
  await expect(page.locator('[data-question-id="q01"]').getByLabel("1-2")).toBeChecked();
});

test("an older local draft remains explicitly restorable or discardable", async ({ page }) => {
  const answers = completeAnswers();
  await page.addInitScript((serverAnswers) => {
    localStorage.setItem("survey-draft:jane li|abc university", JSON.stringify({
      answers: { ...serverAnswers, q01: "3+" },
      savedAt: "2026-09-04T00:00:00.000Z",
    }));
    window.__SURVEY_RUNTIME__ = {
      persistence: {
        async load() {
          return { id: "response-1", answers: serverAnswers, version: 1, updated_at: "2026-09-04T01:00:00.000Z" };
        },
        async save(request) { window.__lastSavedAnswers = request.answers; return { status: "saved", response_version: 2 }; },
      },
    };
  }, answers);
  await page.goto("/index.html");
  await page.getByLabel("Your name").fill("Jane Li");
  await page.getByLabel("Organization").fill("ABC University");
  await page.getByLabel(/I understand/).check();
  await page.getByRole("button", { name: "Continue to survey" }).click();
  await expect(page.locator('[data-question-id="q01"]').getByLabel("0")).toBeChecked();
  await page.getByRole("button", { name: "Restore local draft" }).click();
  await expect(page.locator('[data-question-id="q01"]').getByLabel("3+")).toBeChecked();
  await page.getByRole("button", { name: "Discard local draft" }).click();
  await expect(page.locator('[data-question-id="q01"]').getByLabel("0")).toBeChecked();
  const stored = await page.evaluate(() => localStorage.getItem("survey-draft:jane li|abc university"));
  expect(stored).toBeNull();
  await page.getByRole("button", { name: "Feedback and Suggestions" }).click();
  await page.getByRole("button", { name: "Review answers" }).click();
  await page.getByRole("button", { name: "Submit response" }).click();
  await expect(page.getByRole("heading", { name: "Response saved" })).toBeVisible();
  expect(await page.evaluate(() => window.__lastSavedAnswers.q01)).toBe("0");
});

test("survey remains within a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enterExistingSurvey(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
