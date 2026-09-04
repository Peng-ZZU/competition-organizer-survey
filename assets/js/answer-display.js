export function displayAnswer(question, answers) {
  const answer = answers?.[question.id];
  let display = Array.isArray(answer) ? answer.join(", ") : answer || "Not provided";
  if (question.hasOtherDetail && Array.isArray(answer) && answer.includes("Other")) {
    const detail = typeof answers[`${question.id}_other`] === "string"
      ? answers[`${question.id}_other`].trim()
      : "";
    if (detail) display += `\nOther: ${detail}`;
  }
  return display;
}
