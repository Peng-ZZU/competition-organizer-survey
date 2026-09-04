import assert from "node:assert/strict";
import test from "node:test";
import { questionById, questions } from "../../assets/js/questions.js";
import {
  clearInactiveAnswers,
  isQuestionActive,
  normalizeIdentity,
  validateAnswers,
  validateIdentity,
} from "../../assets/js/survey-logic.js";

test("identity normalization folds width, case, and repeated whitespace", () => {
  assert.equal(normalizeIdentity("  Ｊａｎｅ   LI  "), "jane li");
});

test("conditions activate only for their approved parent answer", () => {
  assert.equal(isQuestionActive(questionById.get("q06"), { q05: "Yes" }), true);
  assert.equal(isQuestionActive(questionById.get("q06"), { q05: "No" }), false);
  assert.equal(isQuestionActive(questionById.get("q10"), { q09: ["Framework", "Data"] }), true);
  assert.equal(isQuestionActive(questionById.get("q10"), { q09: ["Framework"] }), false);
});

test("inactive conditional and Other details are cleared", () => {
  const cleaned = clearInactiveAnswers({
    q05: "No",
    q06: "Old answer",
    q07: ["Academic"],
    q07_other: "Old other",
  }, questions);

  assert.equal("q06" in cleaned, false);
  assert.equal("q07_other" in cleaned, false);
});

test("identity validation reports each blank identity field", () => {
  assert.deepEqual(validateIdentity({ name: "", organization: " " }).map(({ fieldId }) => fieldId), [
    "respondent-name",
    "respondent-organization",
  ]);
});

test("identity validation enforces practical length limits", () => {
  assert.deepEqual(
    validateIdentity({ name: "N".repeat(121), organization: "O".repeat(201) }).map(({ fieldId }) => fieldId),
    ["respondent-name", "respondent-organization"],
  );
});

test("answer validation requires visible choices but permits optional open text", () => {
  const answers = { q01: "0", q02: "Yes" };
  const errors = validateAnswers(answers, questions, { sectionId: "basic" });
  assert.deepEqual(errors, []);

  assert.deepEqual(
    validateAnswers({ q01: "0" }, questions, { sectionId: "basic" }).map(({ fieldId }) => fieldId),
    ["q02"],
  );
  assert.deepEqual(validateAnswers({}, questions, { sectionId: "promotion" }).map(({ fieldId }) => fieldId), ["q12"]);
});

test("answer validation enforces active conditions and Other details", () => {
  assert.deepEqual(
    validateAnswers({ q05: "Yes" }, questions, { sectionId: "statistics" }).map(({ fieldId }) => fieldId),
    ["q03", "q04", "q06"],
  );
  assert.deepEqual(
    validateAnswers({ q07: ["Other"] }, questions, { sectionId: "demographics" }).map(({ fieldId }) => fieldId),
    ["q07_other", "q08"],
  );
});
