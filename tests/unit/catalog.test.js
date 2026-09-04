import assert from "node:assert/strict";
import test from "node:test";
import { expectedQuestions, expectedSections } from "../fixtures/expected-catalog.js";
import { questions, sections } from "../../assets/js/questions.js";

function compactQuestion(question) {
  return [
    question.id,
    question.number,
    question.sectionId,
    question.type,
    question.prompt,
    question.options ?? [],
    question.required,
    Object.hasOwn(question, "condition") ? question.condition : undefined,
    Object.hasOwn(question, "hasOtherDetail") ? question.hasOtherDetail : undefined,
  ].filter((value, index) => index < 7 || value !== undefined);
}

test("catalog contains the ten approved steps in order", () => {
  assert.deepEqual(sections.map(({ id, title }) => [id, title]), expectedSections);
});

test("catalog contains all 34 approved questions without drift", () => {
  assert.deepEqual(questions.map(compactQuestion), expectedQuestions);
});

test("question identifiers and global numbers are unique and sequential", () => {
  assert.equal(new Set(questions.map(({ id }) => id)).size, 34);
  assert.deepEqual(questions.map(({ number }) => number), Array.from({ length: 34 }, (_, index) => index + 1));
});
