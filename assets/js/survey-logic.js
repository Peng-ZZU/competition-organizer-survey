export function normalizeIdentity(value = "") {
  return String(value)
    .normalize("NFKC")
    .trim()
    .replace(/\s+/gu, " ")
    .toLocaleLowerCase("en-US");
}

export function isQuestionActive(question, answers) {
  if (!question.condition) return true;
  const parent = answers[question.condition.questionId];
  if (Object.hasOwn(question.condition, "equals")) {
    return parent === question.condition.equals;
  }
  if (Object.hasOwn(question.condition, "includes")) {
    return Array.isArray(parent) && parent.includes(question.condition.includes);
  }
  return false;
}

export function clearInactiveAnswers(answers, catalog) {
  const cleaned = { ...answers };
  for (const question of catalog) {
    if (!isQuestionActive(question, cleaned)) delete cleaned[question.id];
    if (
      question.hasOtherDetail &&
      (!Array.isArray(cleaned[question.id]) || !cleaned[question.id].includes("Other"))
    ) {
      delete cleaned[`${question.id}_other`];
    }
  }
  return cleaned;
}

export function validateIdentity({ name, organization }) {
  const errors = [];
  if (!normalizeIdentity(name)) {
    errors.push({ fieldId: "respondent-name", message: "Name is required." });
  } else if (String(name).length > 120) {
    errors.push({ fieldId: "respondent-name", message: "Name must be 120 characters or fewer." });
  }
  if (!normalizeIdentity(organization)) {
    errors.push({ fieldId: "respondent-organization", message: "Organization is required." });
  } else if (String(organization).length > 200) {
    errors.push({ fieldId: "respondent-organization", message: "Organization must be 200 characters or fewer." });
  }
  return errors;
}

function hasValidAnswer(question, value) {
  if (question.type === "text") return typeof value === "string" && value.trim() !== "";
  if (question.type === "multi") {
    return Array.isArray(value) && value.length > 0 && value.every((item) => question.options.includes(item));
  }
  return typeof value === "string" && question.options.includes(value);
}

export function validateAnswers(answers, catalog, { sectionId } = {}) {
  const errors = [];
  for (const question of catalog) {
    if (sectionId && question.sectionId !== sectionId) continue;
    if (!isQuestionActive(question, answers)) continue;

    const value = answers[question.id];
    if (question.required && !hasValidAnswer(question, value)) {
      errors.push({ fieldId: question.id, message: "This question is required." });
      continue;
    }
    if (value !== undefined && value !== "" && !hasValidAnswer(question, value)) {
      errors.push({ fieldId: question.id, message: "Select a valid answer." });
      continue;
    }
    if (question.hasOtherDetail && Array.isArray(value) && value.includes("Other")) {
      const otherKey = `${question.id}_other`;
      if (typeof answers[otherKey] !== "string" || !answers[otherKey].trim()) {
        errors.push({ fieldId: otherKey, message: "Please describe your Other selection." });
      }
    }
  }
  return errors;
}
