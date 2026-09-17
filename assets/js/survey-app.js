import { questions, sections } from "./questions.js";
import { buildSurveyPages, clearInactiveAnswers, isQuestionActive, pageIndexForSection, validateAnswers, validateIdentity } from "./survey-logic.js";
import { createDraftStore, decideInitialSource } from "./draft-store.js";
import { createSubmissionController } from "./persistence.js";
import { createBrowserRuntimes, readRuntimeConfig } from "./runtime.js";
import { displayAnswer } from "./answer-display.js";

const root = document.querySelector("#survey-app");
const draftStore = createDraftStore(window.localStorage);
const surveyPages = buildSurveyPages(questions);
let configurationError = "";
let surveyRuntime = window.__SURVEY_RUNTIME__;
if (!surveyRuntime) {
  try {
    const config = readRuntimeConfig(window);
    surveyRuntime = createBrowserRuntimes(window.supabase.createClient, config).survey;
  } catch (error) {
    configurationError = error.message;
  }
}

const appState = {
  identity: null,
  response: null,
  answers: {},
  currentPageIndex: 0,
  bannerMessage: "",
  persistence: null,
  submissionController: null,
  localDraft: null,
  usingLocalDraft: false,
  baselineAnswers: {},
};

function contactMarkup() {
  return `Questions? Contact Dr. Song at <a href="mailto:hui.song@rmit.edu.au">hui.song@rmit.edu.au</a>.`;
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character]);
}

function renderEntry(errors = []) {
  root.innerHTML = `
    <div class="site-shell entry-shell">
      <header class="survey-brand">
        <span class="eyebrow">IEEE CIS · ORGANIZER RESEARCH</span>
        <h1>Survey for Competition Organizers</h1>
        <p class="lead">Help us understand how competitions are organized, supported, and improved.</p>
      </header>
      <section class="entry-card" aria-labelledby="respondent-details-title">
        <div>
          <span class="step-label">Before you begin</span>
          <h2 id="respondent-details-title">Respondent Details</h2>
          <p>Your name, organization, and responses will be used only by the organizers for market research and aggregated analysis.</p>
          <p class="privacy-note">Anyone who knows the same name and organization can reload and revise that response.</p>
        </div>
        ${configurationError ? `<div class="setup-notice" role="status"><strong>Survey storage is not configured.</strong><p>Ask the site owner to add the Supabase project URL and public anonymous key in <code>assets/js/config.js</code>.</p></div>` : ""}
        ${errors.length ? `<div class="error-summary" role="alert"><strong>Please fix the following:</strong><ul>${errors.map((error) => `<li><a href="#${error.fieldId}">${escapeHtml(error.message)}</a></li>`).join("")}</ul></div>` : ""}
        <form id="identity-form" novalidate>
          <label for="respondent-name">Your name <span aria-hidden="true">*</span></label>
          <input id="respondent-name" name="name" autocomplete="name" maxlength="120" value="${escapeHtml(appState.identity?.name ?? "")}">
          <label for="respondent-organization">Organization <span aria-hidden="true">*</span></label>
          <input id="respondent-organization" name="organization" autocomplete="organization" maxlength="200" value="${escapeHtml(appState.identity?.organization ?? "")}">
          <label class="consent-row" for="privacy-consent">
            <input id="privacy-consent" name="consent" type="checkbox">
            <span>I understand how my identity and responses will be used.</span>
          </label>
          <button class="primary-button" type="submit" ${configurationError ? "disabled" : ""}>Continue to survey</button>
        </form>
      </section>
      <footer class="contact-line">${contactMarkup()}</footer>
    </div>`;

  root.querySelector("#identity-form").addEventListener("submit", handleIdentitySubmit);
}

async function handleIdentitySubmit(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const identity = { name: form.get("name") ?? "", organization: form.get("organization") ?? "" };
  const errors = validateIdentity(identity);
  if (!form.get("consent")) errors.push({ fieldId: "privacy-consent", message: "Please accept the privacy notice." });
  appState.identity = identity;
  if (errors.length) {
    renderEntry(errors);
    root.querySelector(`#${errors[0].fieldId}`)?.focus();
    return;
  }

  const button = event.currentTarget.querySelector("button[type=submit]");
  button.disabled = true;
  button.textContent = "Loading your response…";
  try {
    const persistence = surveyRuntime?.persistence;
    if (!persistence) throw new Error("Survey storage is not configured yet.");
    const response = await persistence.load(identity.name, identity.organization);
    const draft = draftStore.load(identity);
    const source = decideInitialSource(response, draft);
    appState.response = response;
    appState.persistence = persistence;
    appState.submissionController = createSubmissionController(persistence);
    appState.answers = source.defaultSource === "draft"
      ? structuredClone(draft.answers ?? {})
      : response?.answers ? structuredClone(response.answers) : {};
    appState.baselineAnswers = response?.answers ? structuredClone(response.answers) : {};
    appState.bannerMessage = source.defaultSource === "draft"
      ? "Local draft restored"
      : response ? "Existing response loaded" : "";
    appState.localDraft = draft;
    appState.usingLocalDraft = source.defaultSource === "draft";
    appState.currentPageIndex = 0;
    renderSurveyPage();
  } catch (error) {
    renderEntry([{ fieldId: "respondent-name", message: error.message }]);
  }
}

function questionMarkup(question, errors = []) {
  if (!isQuestionActive(question, appState.answers)) return "";
  const value = appState.answers[question.id];
  const questionError = errors.find(({ fieldId }) => fieldId === question.id);
  const required = question.required ? `<span class="required-label">Required</span>` : `<span class="optional-label">Optional</span>`;
  const invalidAttributes = questionError ? `aria-invalid="true" aria-describedby="${question.id}-error"` : "";
  let control = "";

  if (question.type === "text") {
    control = `<textarea id="${question.id}" name="${question.id}" rows="4" ${invalidAttributes}>${escapeHtml(value ?? "")}</textarea>`;
  } else {
    const inputType = question.type === "multi" ? "checkbox" : "radio";
    control = `<div class="choice-grid ${question.type === "rating" ? "rating-grid" : ""}">${question.options.map((option) => {
      const checked = inputType === "checkbox" ? Array.isArray(value) && value.includes(option) : value === option;
      return `<label class="choice-card"><input type="${inputType}" name="${question.id}" value="${escapeHtml(option)}" ${checked ? "checked" : ""} ${invalidAttributes}><span>${escapeHtml(option)}</span></label>`;
    }).join("")}</div>`;
  }

  const otherKey = `${question.id}_other`;
  const otherError = errors.find(({ fieldId }) => fieldId === otherKey);
  const other = question.hasOtherDetail && Array.isArray(value) && value.includes("Other")
    ? `<label class="other-detail" for="${otherKey}">Please describe your Other selection for question ${question.number}<input id="${otherKey}" name="${otherKey}" value="${escapeHtml(appState.answers[otherKey] ?? "")}" ${otherError ? `aria-invalid="true" aria-describedby="${question.id}-error"` : ""}></label>`
    : "";

  const fieldError = questionError ?? otherError;
  return `<fieldset id="${question.id}-field" class="question-card" data-question-id="${question.id}"><legend><span class="question-number">Question ${question.number}</span>${escapeHtml(question.prompt)} ${required}</legend>${control}${other}<p class="field-error" id="${question.id}-error" ${fieldError ? "" : "hidden"}>${escapeHtml(fieldError?.message ?? "")}</p></fieldset>`;
}

function renderSurveyPage(errors = []) {
  const pageIndex = appState.currentPageIndex;
  const page = surveyPages[pageIndex] ?? surveyPages[0];
  const currentSection = sections.find(({ id }) => id === page.sectionId) ?? sections[1];
  const currentIndex = sections.findIndex(({ id }) => id === currentSection.id);
  const isLastPage = pageIndex === surveyPages.length - 1;
  root.innerHTML = `
    <div class="site-shell survey-shell">
      <header class="compact-header">
        <div><span class="eyebrow">IEEE CIS · ORGANIZER RESEARCH</span><h1>Survey for Competition Organizers</h1></div>
        <div class="respondent-chip">${escapeHtml(appState.identity.name)}<small>${escapeHtml(appState.identity.organization)}</small></div>
      </header>
      ${appState.bannerMessage ? `<div class="success-banner" role="status"><strong>${escapeHtml(appState.bannerMessage)}</strong>${appState.response ? `<span>Last saved ${new Date(appState.response.updated_at).toLocaleString("en")}</span>` : ""}</div>` : ""}
      ${appState.localDraft ? `<div class="draft-banner" role="status"><div><strong>${appState.usingLocalDraft ? "Using your local draft" : "A local draft is also available"}</strong><span>Saved in this browser ${new Date(appState.localDraft.savedAt).toLocaleString("en")}</span></div><div>${appState.usingLocalDraft ? "" : `<button class="secondary-button" type="button" id="restore-local-draft">Restore local draft</button>`}<button class="text-button" type="button" id="discard-local-draft">Discard local draft</button></div></div>` : ""}
      <div class="survey-layout">
        <nav class="section-nav" aria-label="Survey sections">
          ${sections.slice(1).map((section) => `<button type="button" class="section-link ${section.id === currentSection.id ? "active" : ""}" data-section-id="${section.id}">${escapeHtml(section.title)}</button>`).join("")}
        </nav>
        <section class="questionnaire-card">
          <div class="progress-track" aria-label="Survey progress"><span style="width:${Math.max(0, (pageIndex / (surveyPages.length - 1)) * 100)}%"></span></div>
          <span class="step-label">Section ${currentIndex} of ${sections.length - 1} · Page ${pageIndex + 1} of ${surveyPages.length}</span>
          <h2>${escapeHtml(currentSection.title)}</h2>
          ${errors.length ? `<div class="error-summary" role="alert"><strong>${errors.length} required ${errors.length === 1 ? "answer needs" : "answers need"} attention.</strong><ul>${errors.map((error) => `<li><a href="#${error.fieldId.replace(/_other$/u, "")}-field">${escapeHtml(error.message)}</a></li>`).join("")}</ul></div>` : ""}
          <form id="section-form" novalidate>${page.questions.map((question) => questionMarkup(question, errors)).join("")}</form>
          <div class="form-actions">
            ${pageIndex > 0 ? `<button class="secondary-button" type="button" id="previous-page">Back</button>` : `<span></span>`}
            <button class="primary-button" type="button" id="next-page">${isLastPage ? "Review answers" : "Next page"}</button>
          </div>
        </section>
      </div>
      <footer class="contact-line">${contactMarkup()}</footer>
    </div>`;

  root.querySelectorAll("[data-section-id]").forEach((button) => button.addEventListener("click", () => {
    appState.currentPageIndex = pageIndexForSection(surveyPages, button.dataset.sectionId);
    renderSurveyPage();
  }));
  root.querySelector("#section-form").addEventListener("input", handleAnswerInput);
  root.querySelector("#section-form").addEventListener("change", handleAnswerInput);
  root.querySelector("#restore-local-draft")?.addEventListener("click", () => {
    appState.answers = structuredClone(appState.localDraft.answers ?? {});
    appState.usingLocalDraft = true;
    appState.bannerMessage = "Local draft restored";
    renderSurveyPage();
  });
  root.querySelector("#discard-local-draft")?.addEventListener("click", () => {
    draftStore.clear(appState.identity);
    appState.answers = structuredClone(appState.baselineAnswers);
    appState.localDraft = null;
    appState.usingLocalDraft = false;
    if (appState.bannerMessage === "Local draft restored") {
      appState.bannerMessage = appState.response ? "Existing response loaded" : "";
    }
    renderSurveyPage();
  });
  root.querySelector("#previous-page")?.addEventListener("click", () => {
    appState.currentPageIndex = Math.max(0, pageIndex - 1);
    renderSurveyPage();
  });
  root.querySelector("#next-page").addEventListener("click", () => {
    const validationErrors = validateAnswers(appState.answers, questions, { questionIds: page.questionIds });
    if (validationErrors.length) {
      renderSurveyPage(validationErrors);
      root.querySelector(`[name="${validationErrors[0].fieldId}"]`)?.focus();
      return;
    }
    if (isLastPage) renderReview();
    else {
      appState.currentPageIndex = pageIndex + 1;
      renderSurveyPage();
    }
  });
}

function handleAnswerInput(event) {
  const target = event.target;
  if (!target.name) return;
  const focusName = target.name;
  const focusValue = target.value;
  if (target.type === "checkbox") {
    const selected = new Set(appState.answers[target.name] ?? []);
    if (target.checked) selected.add(target.value); else selected.delete(target.value);
    appState.answers[target.name] = [...selected];
  } else {
    appState.answers[target.name] = target.value;
  }
  appState.answers = clearInactiveAnswers(appState.answers, questions);
  if (appState.identity) {
    appState.localDraft = { answers: structuredClone(appState.answers), savedAt: new Date().toISOString() };
    appState.usingLocalDraft = true;
    draftStore.save(appState.identity, appState.localDraft);
  }
  if (event.type === "change" && (target.type === "radio" || target.type === "checkbox")) {
    renderSurveyPage();
    const candidates = [...root.querySelectorAll(`[name="${focusName}"]`)];
    (candidates.find((candidate) => candidate.value === focusValue) ?? candidates[0])?.focus();
  }
}

function answerLabel(question) {
  return displayAnswer(question, appState.answers);
}

function submissionNotice(status, error) {
  if (status === "failed") {
    return `<div class="error-summary" role="alert"><strong>Your response was not saved.</strong><p>${escapeHtml(error?.message || "Please check your connection and try again.")}</p><button class="secondary-button" type="button" id="retry-submission">Retry submission</button></div>`;
  }
  if (status === "conflict") {
    return `<div class="error-summary" role="alert"><strong>This response was updated somewhere else.</strong><p>Reload the latest response before making further changes.</p><button class="secondary-button" type="button" id="reload-latest">Reload latest response</button></div>`;
  }
  return "";
}

function renderReview({ status = "ready", error = null } = {}) {
  root.innerHTML = `
    <div class="site-shell survey-shell">
      <header class="compact-header">
        <div><span class="eyebrow">FINAL REVIEW</span><h1>Review your answers</h1></div>
        <div class="respondent-chip">${escapeHtml(appState.identity.name)}<small>${escapeHtml(appState.identity.organization)}</small></div>
      </header>
      ${submissionNotice(status, error)}
      <div class="review-list">
        ${sections.slice(1).map((section) => `
          <section class="review-section">
            <div class="review-heading"><h2>${escapeHtml(section.title)}</h2><button class="text-button" type="button" data-edit-section="${section.id}">Edit ${escapeHtml(section.title)}</button></div>
            <dl>${questions.filter((question) => question.sectionId === section.id && isQuestionActive(question, appState.answers)).map((question) => `<div><dt>${question.number}. ${escapeHtml(question.prompt)}</dt><dd>${escapeHtml(answerLabel(question))}</dd></div>`).join("")}</dl>
          </section>`).join("")}
      </div>
      <div class="form-actions"><button class="secondary-button" type="button" id="back-from-review">Back</button><button class="primary-button" type="button" id="submit-survey" ${status === "saving" ? "disabled" : ""}>${status === "saving" ? "Saving…" : "Submit response"}</button></div>
      <footer class="contact-line">${contactMarkup()}</footer>
    </div>`;
  root.querySelectorAll("[data-edit-section]").forEach((button) => button.addEventListener("click", () => {
    appState.currentPageIndex = pageIndexForSection(surveyPages, button.dataset.editSection);
    renderSurveyPage();
  }));
  root.querySelector("#back-from-review").addEventListener("click", () => {
    appState.currentPageIndex = surveyPages.length - 1;
    renderSurveyPage();
  });
  root.querySelector("#submit-survey").addEventListener("click", handleSubmit);
  root.querySelector("#retry-submission")?.addEventListener("click", handleRetry);
  root.querySelector("#reload-latest")?.addEventListener("click", handleReloadLatest);
}

async function handleSubmit() {
  const cleanedAnswers = clearInactiveAnswers(appState.answers, questions);
  const errors = validateAnswers(cleanedAnswers, questions);
  if (errors.length) {
    const questionIdFor = (fieldId) => fieldId.replace(/_other$/u, "");
    const errorPageIndex = surveyPages.findIndex((page) => page.questionIds.includes(questionIdFor(errors[0].fieldId)));
    appState.currentPageIndex = errorPageIndex === -1 ? 0 : errorPageIndex;
    const errorPageQuestionIds = surveyPages[appState.currentPageIndex].questionIds;
    renderSurveyPage(errors.filter(({ fieldId }) => errorPageQuestionIds.includes(questionIdFor(fieldId))));
    root.querySelector(`[name="${errors[0].fieldId}"]`)?.focus();
    return;
  }
  renderReview({ status: "saving" });
  try {
    const result = await appState.submissionController.submit({
      name: appState.identity.name,
      organization: appState.identity.organization,
      answers: cleanedAnswers,
      expectedVersion: appState.response?.version ?? null,
    });
    if (result.status === "conflict") {
      renderReview({ status: "conflict" });
      return;
    }
    completeSuccessfulSave(result);
  } catch (error) {
    renderReview({ status: "failed", error });
  }
}

async function handleRetry() {
  renderReview({ status: "saving" });
  try {
    const result = await appState.submissionController.retry();
    if (result.status === "conflict") renderReview({ status: "conflict" });
    else completeSuccessfulSave(result);
  } catch (error) {
    renderReview({ status: "failed", error });
  }
}

async function handleReloadLatest() {
  try {
    const response = await appState.persistence.load(appState.identity.name, appState.identity.organization);
    if (!response) throw new Error("The latest response could not be found.");
    appState.response = response;
    appState.answers = structuredClone(response.answers);
    appState.baselineAnswers = structuredClone(response.answers);
    draftStore.clear(appState.identity);
    appState.localDraft = null;
    appState.usingLocalDraft = false;
    appState.bannerMessage = "Latest response loaded";
    appState.currentPageIndex = pageIndexForSection(surveyPages, "feedback");
    renderSurveyPage();
  } catch (error) {
    renderReview({ status: "failed", error });
  }
}

function completeSuccessfulSave(result) {
  const savedAt = result.updated_at ?? new Date().toISOString();
  appState.response = {
    ...(appState.response ?? {}),
    version: result.response_version,
    updated_at: savedAt,
    answers: structuredClone(appState.answers),
  };
  appState.baselineAnswers = structuredClone(appState.answers);
  draftStore.clear(appState.identity);
  appState.localDraft = null;
  appState.usingLocalDraft = false;
  root.innerHTML = `
    <div class="site-shell entry-shell">
      <section class="entry-card save-success" role="status">
        <span class="success-mark" aria-hidden="true">✓</span>
        <span class="eyebrow">SUBMISSION CONFIRMED</span>
        <h1>Response saved</h1>
        <p>Your response was saved on <strong>${escapeHtml(new Date(savedAt).toLocaleString("en"))}</strong>.</p>
        <p>You can return later and use the same name and organization to revise it.</p>
        <button class="secondary-button" type="button" id="edit-saved-response">Review or edit response</button>
      </section>
      <footer class="contact-line">${contactMarkup()}</footer>
    </div>`;
  root.querySelector("#edit-saved-response").addEventListener("click", () => {
    appState.currentPageIndex = 0;
    appState.bannerMessage = "Existing response loaded";
    renderSurveyPage();
  });
}

renderEntry();

export { appState, renderEntry };
