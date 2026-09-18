import assert from "node:assert/strict";
import test from "node:test";
import { buildResponsesCsv, escapeCsvCell } from "../../assets/js/csv.js";

test("CSV escaping quotes fields and neutralizes spreadsheet formulas", () => {
  assert.equal(escapeCsvCell("plain"), "plain");
  assert.equal(escapeCsvCell("line one\nline two"), '"line one\nline two"');
  assert.equal(escapeCsvCell('say "hello"'), '"say ""hello"""');
  assert.equal(escapeCsvCell("=HYPERLINK(\"bad\")"), '"\'=HYPERLINK(""bad"")"');
  assert.equal(escapeCsvCell(" +SUM(A1:A2)"), "' +SUM(A1:A2)");
});

test("CSV export uses fixed question order and deterministic multi-select values", () => {
  const csv = buildResponsesCsv([
    {
      respondent_name: "张三",
      organization: "示例大学",
      created_at: "2026-09-01T01:00:00Z",
      updated_at: "2026-09-02T01:00:00Z",
      answers: { q01: "1-2", q07: ["Industry", "Academic", "Other"], q07_other: "=Researchers", q27: "Line one\nLine two" },
    },
  ]);

  assert.ok(csv.startsWith("\uFEFFName,Organization,Created At,Last Updated,Question 1:"));
  assert.ok(csv.includes("Academic; Industry; Other"));
  assert.ok(csv.includes("'=Researchers"));
  assert.ok(csv.includes('"Line one\nLine two"'));
  assert.ok(csv.indexOf("Question 1:") < csv.indexOf("Question 23:"));
});

test("CSV export preserves partial responses with empty unanswered cells", () => {
  const csv = buildResponsesCsv([{ respondent_name: "Partial Jane", organization: "Partial Org", answers: { q01: "1-2" } }]);
  const row = csv.split("\n")[1];
  assert.match(csv, /Partial Jane,Partial Org/);
  assert.ok(row.includes(",1-2,"));
  assert.ok(csv.includes("Question 23:"));
});
