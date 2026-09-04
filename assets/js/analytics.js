import { questions } from "./questions.js";
import { isQuestionActive, normalizeIdentity } from "./survey-logic.js";

function percentage(count, total) {
  return total ? Math.round((count / total) * 1000) / 10 : 0;
}

export function calculateOverview(responses) {
  const organizations = new Set(
    responses
      .map((response) => response.normalized_organization || normalizeIdentity(response.organization))
      .filter(Boolean),
  );
  const planAnswers = responses
    .map((response) => response.answers?.q02)
    .filter((answer) => answer === "Yes" || answer === "No");
  const yes = planAnswers.filter((answer) => answer === "Yes").length;
  return {
    completedResponses: responses.length,
    organizationsRepresented: organizations.size,
    planToRunAgain: {
      yes,
      valid: planAnswers.length,
      percentage: percentage(yes, planAnswers.length),
    },
  };
}

export function distributionForQuestion(question, responses) {
  const validAnswers = responses
    .map((response) => response.answers?.[question.id])
    .filter((answer) => {
      if (question.type === "multi") {
        return Array.isArray(answer) && answer.length > 0 && answer.every((item) => question.options.includes(item));
      }
      return typeof answer === "string" && question.options.includes(answer);
    });
  if (!validAnswers.length) return { total: 0, empty: true, options: [] };

  return {
    total: validAnswers.length,
    empty: false,
    options: question.options.map((label) => {
      const count = validAnswers.filter((answer) => (
        question.type === "multi" ? answer.includes(label) : answer === label
      )).length;
      return { label, count, percentage: percentage(count, validAnswers.length) };
    }),
  };
}

export function collectOpenResponses(responses, catalog = questions) {
  const entries = [];
  for (const response of responses) {
    const answers = response.answers ?? {};
    const attribution = `${response.organization} · ${response.respondent_name}`;
    for (const question of catalog) {
      if (!isQuestionActive(question, answers)) continue;
      if (question.type === "text") {
        const answer = typeof answers[question.id] === "string" ? answers[question.id].trim() : "";
        if (answer) entries.push({
          questionId: question.id,
          questionNumber: question.number,
          prompt: question.prompt,
          name: response.respondent_name,
          organization: response.organization,
          attribution,
          answer,
        });
      }
      if (question.hasOtherDetail && Array.isArray(answers[question.id]) && answers[question.id].includes("Other")) {
        const key = `${question.id}_other`;
        const answer = typeof answers[key] === "string" ? answers[key].trim() : "";
        if (answer) entries.push({
          questionId: key,
          parentQuestionId: question.id,
          questionNumber: question.number,
          prompt: `${question.prompt} — Other`,
          name: response.respondent_name,
          organization: response.organization,
          attribution,
          answer,
        });
      }
    }
  }
  return entries;
}

export function filterOpenResponses(entries, { query = "", questionId = "" } = {}) {
  const needle = normalizeIdentity(query);
  return entries.filter((entry) => {
    if (questionId && entry.questionId !== questionId && entry.parentQuestionId !== questionId) return false;
    if (!needle) return true;
    return normalizeIdentity(`${entry.name} ${entry.organization} ${entry.answer}`).includes(needle);
  });
}
