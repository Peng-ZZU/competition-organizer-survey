import { questions } from "./questions.js";
import { isQuestionActive } from "./survey-logic.js";

export function escapeCsvCell(value) {
  let text = String(value ?? "");
  if (/^\s*[=+\-@]/u.test(text)) text = `'${text}`;
  if (/[",\r\n]/u.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function questionHeaders(catalog) {
  return catalog.flatMap((question) => [
    `Question ${question.number}: ${question.prompt}`,
    ...(question.hasOtherDetail ? [`Question ${question.number} Other`] : []),
  ]);
}

function answerCells(response, catalog) {
  const answers = response.answers ?? {};
  return catalog.flatMap((question) => {
    let value = "";
    if (isQuestionActive(question, answers)) {
      const answer = answers[question.id];
      value = Array.isArray(answer)
        ? question.options.filter((option) => answer.includes(option)).join("; ")
        : answer ?? "";
    }
    return [value, ...(question.hasOtherDetail ? [answers[`${question.id}_other`] ?? ""] : [])];
  });
}

export function buildResponsesCsv(responses, catalog = questions) {
  const rows = [
    ["Name", "Organization", "Created At", "Last Updated", ...questionHeaders(catalog)],
    ...responses.map((response) => [
      response.respondent_name,
      response.organization,
      response.created_at,
      response.updated_at,
      ...answerCells(response, catalog),
    ]),
  ];
  return `\uFEFF${rows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n")}`;
}
