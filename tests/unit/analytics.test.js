import assert from "node:assert/strict";
import test from "node:test";
import { questionById } from "../../assets/js/questions.js";
import { calculateOverview, collectOpenResponses, distributionForQuestion, filterOpenResponses } from "../../assets/js/analytics.js";

const responses = [
  { organization: "ABC University", normalized_organization: "abc university", answers: { q02: "Yes", q03: "10+", q07: ["Academic", "Industry"] } },
  { organization: " abc university ", normalized_organization: "abc university", answers: { q02: "No", q03: "5-9", q07: ["Industry"] } },
  { organization: "XYZ Institute", normalized_organization: "xyz institute", answers: { q02: "Yes", q03: "10+", q07: ["Academic", "Industry"] } },
];

test("overview calculates response, organization, and plan-again metrics", () => {
  assert.deepEqual(calculateOverview(responses), {
    completedResponses: 3,
    organizationsRepresented: 2,
    planToRunAgain: { yes: 2, valid: 3, percentage: 66.7 },
  });
});

test("single-choice distribution uses valid answers as denominator", () => {
  assert.deepEqual(distributionForQuestion(questionById.get("q03"), responses), {
    total: 3,
    empty: false,
    options: [
      { label: "0", count: 0, percentage: 0 },
      { label: "1-4", count: 0, percentage: 0 },
      { label: "5-9", count: 1, percentage: 33.3 },
      { label: "10+", count: 2, percentage: 66.7 },
    ],
  });
});

test("multi-choice distribution uses respondents and may exceed 100 percent", () => {
  const distribution = distributionForQuestion(questionById.get("q07"), responses);
  assert.equal(distribution.total, 3);
  assert.deepEqual(distribution.options.slice(0, 4), [
    { label: "Academic", count: 2, percentage: 66.7 },
    { label: "University Student", count: 0, percentage: 0 },
    { label: "High School Student", count: 0, percentage: 0 },
    { label: "Industry", count: 3, percentage: 100 },
  ]);
  assert.ok(distribution.options.reduce((sum, option) => sum + option.percentage, 0) > 100);
});

test("distribution reports an explicit empty state", () => {
  assert.deepEqual(distributionForQuestion(questionById.get("q03"), []), {
    total: 0,
    empty: true,
    options: [],
  });
});

test("open responses are attributed and inactive conditional answers are omitted", () => {
  const entries = collectOpenResponses([
    {
      respondent_name: "Jane Li",
      organization: "ABC University",
      answers: { q05: "No", q06: "Stale private list", q07: ["Other"], q07_other: "Researchers", q27: "  Strong community  " },
    },
    {
      respondent_name: "Alex Chen",
      organization: "XYZ Institute",
      answers: { q27: "" },
    },
  ]);

  assert.deepEqual(entries.map(({ questionId, attribution, answer }) => [questionId, attribution, answer]), [
    ["q07_other", "ABC University · Jane Li", "Researchers"],
    ["q27", "ABC University · Jane Li", "Strong community"],
  ]);
});

test("open response filtering matches question, name, organization, and text", () => {
  const entries = collectOpenResponses([
    { respondent_name: "Jane Li", organization: "ABC University", answers: { q27: "Strong community" } },
    { respondent_name: "Alex Chen", organization: "XYZ Institute", answers: { q28: "Earlier publicity" } },
  ]);
  assert.equal(filterOpenResponses(entries, { query: "xyz" }).length, 1);
  assert.equal(filterOpenResponses(entries, { query: "publicity" }).length, 1);
  assert.equal(filterOpenResponses(entries, { questionId: "q27" }).length, 1);
});
