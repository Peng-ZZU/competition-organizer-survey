import assert from "node:assert/strict";
import test from "node:test";
import { expectedPageQuestionIds } from "../fixtures/expected-catalog.js";
import { questionById, questions } from "../../assets/js/questions.js";
import {
  buildSurveyPages,
  clearInactiveAnswers,
  isQuestionActive,
  normalizeIdentity,
  pageIndexForSection,
  validateAnswers,
  validateIdentity,
} from "../../assets/js/survey-logic.js";

test("survey pages hold two choice questions or one open text question", () => {
  const pages = buildSurveyPages(questions);
  assert.deepEqual(pages.map(({ questionIds }) => questionIds), expectedPageQuestionIds);

  for (const page of pages) {
    const types = page.questionIds.map((id) => questionById.get(id).type);
    const textCount = types.filter((type) => type === "text").length;
    const choiceCount = types.length - textCount;
    assert.ok(textCount === 0 || (textCount === 1 && choiceCount === 0), `page ${page.id} mixes open text with choice questions`);
    assert.ok(choiceCount <= 2, `page ${page.id} holds more than two choice questions`);
  }
});

test("survey pages never span two sections", () => {
  for (const page of buildSurveyPages(questions)) {
    const sectionIds = new Set(page.questionIds.map((id) => questionById.get(id).sectionId));
    assert.equal(sectionIds.size, 1, `page ${page.id} spans sections`);
    assert.equal([...sectionIds][0], page.sectionId);
  }
});

test("section lookup points at the first page of that section", () => {
  const pages = buildSurveyPages(questions);
  assert.equal(pageIndexForSection(pages, "basic"), 0);
  assert.equal(pageIndexForSection(pages, "logistics"), 6);
  assert.equal(pageIndexForSection(pages, "feedback"), 9);
  assert.equal(pageIndexForSection(pages, "missing"), -1);
});

test("identity normalization folds width, case, and repeated whitespace", () => {
  assert.equal(normalizeIdentity("  Ｊａｎｅ   LI  "), "jane li");
});

const conditionalCatalog = [
  { id: "c01", number: 1, sectionId: "demo", type: "single", prompt: "Parent question", options: ["Yes", "No"], required: true },
  { id: "c02", number: 2, sectionId: "demo", type: "text", prompt: "Describe how", options: [], required: true, condition: { questionId: "c01", equals: "Yes" } },
  { id: "c03", number: 3, sectionId: "demo", type: "multi", prompt: "Which resources", options: ["Framework", "Data"], required: true, condition: { questionId: "c04", includes: "Data" } },
  { id: "c04", number: 4, sectionId: "demo", type: "multi", prompt: "Resources provided", options: ["Framework", "Data", "Other"], required: true, hasOtherDetail: true },
];

test("conditions activate only for their approved parent answer", () => {
  assert.equal(isQuestionActive(conditionalCatalog[1], { c01: "Yes" }), true);
  assert.equal(isQuestionActive(conditionalCatalog[1], { c01: "No" }), false);
  assert.equal(isQuestionActive(conditionalCatalog[2], { c04: ["Framework", "Data"] }), true);
  assert.equal(isQuestionActive(conditionalCatalog[2], { c04: ["Framework"] }), false);
});

test("inactive conditional and Other details are cleared", () => {
  const cleaned = clearInactiveAnswers({
    c01: "No",
    c02: "Old answer",
    c04: ["Framework"],
    c04_other: "Old other",
  }, conditionalCatalog);

  assert.equal("c02" in cleaned, false);
  assert.equal("c04_other" in cleaned, false);
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
  const errors = validateAnswers(answers, questions, { questionIds: ["q01", "q02"] });
  assert.deepEqual(errors, []);

  assert.deepEqual(
    validateAnswers({ q01: "0" }, questions, { questionIds: ["q01", "q02"] }).map(({ fieldId }) => fieldId),
    ["q02"],
  );
  assert.deepEqual(validateAnswers({}, questions, { questionIds: ["q12"] }).map(({ fieldId }) => fieldId), ["q12"]);
  assert.deepEqual(validateAnswers({}, questions, { questionIds: ["q27", "q32"] }), []);
});

test("answer validation enforces active conditions and Other details", () => {
  assert.deepEqual(
    validateAnswers({ c04: ["Data"] }, conditionalCatalog, { questionIds: ["c03", "c04"] }).map(({ fieldId }) => fieldId),
    ["c03"],
  );
  assert.deepEqual(
    validateAnswers({ c01: "Yes", c02: "Because", c04: ["Other"] }, conditionalCatalog, { questionIds: ["c01", "c02", "c04"] }).map(({ fieldId }) => fieldId),
    ["c04_other"],
  );
});
