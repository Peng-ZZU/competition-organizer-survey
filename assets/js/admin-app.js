import { calculateOverview, collectOpenResponses, distributionForQuestion, filterOpenResponses } from "./analytics.js";
import { buildResponsesCsv } from "./csv.js";
import { questions } from "./questions.js";
import { createBrowserRuntimes, readRuntimeConfig } from "./runtime.js";
import { displayAnswer } from "./answer-display.js";
import { createAdminMutationController } from "./admin-mutations.js";

const root = document.querySelector("#admin-app");
let runtime = window.__ADMIN_RUNTIME__;
let configurationError = "";
if (!runtime) {
  try {
    const config = readRuntimeConfig(window);
    runtime = createBrowserRuntimes(window.supabase.createClient, config).admin;
  } catch (error) {
    configurationError = error.message;
  }
}

const state = {
  session: null,
  responses: [],
  deletedResponses: [],
  activeView: "overview",
  loaded: false,
  notice: "",
};
let charts = [];
let mutationController = runtime?.data ? createAdminMutationController(runtime.data) : null;

function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character]);
}

function renderLogin(message = "") {
  state.session = null;
  state.responses = [];
  state.deletedResponses = [];
  state.loaded = false;
  state.notice = "";
  root.innerHTML = `
    <div class="site-shell admin-login-shell">
      <section class="entry-card admin-login-card">
        <span class="eyebrow">PRIVATE ORGANIZER AREA</span>
        <h1>Organizer sign in</h1>
        <p class="lead">Sign in with the administrator account created in Supabase.</p>
        ${message ? `<div class="error-summary" role="alert">${message}</div>` : ""}
        <form id="admin-login-form">
          <label for="admin-email">Email</label>
          <input id="admin-email" name="email" type="email" autocomplete="username" required>
          <label for="admin-password">Password</label>
          <input id="admin-password" name="password" type="password" autocomplete="current-password" required>
          <button class="primary-button" type="submit">Sign in</button>
        </form>
        <p class="admin-help">Access is limited to pre-authorized organizers.</p>
      </section>
    </div>`;
  root.querySelector("#admin-login-form").addEventListener("submit", handleLogin);
}

async function handleLogin(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const button = event.currentTarget.querySelector("button");
  button.disabled = true;
  button.textContent = "Signing in…";
  try {
    const session = await runtime.auth.signIn(form.get("email"), form.get("password"));
    if (!state.session) {
      state.session = session;
      renderDashboardShell();
    }
  } catch {
    renderLogin("Sign in failed. Check your credentials and try again.");
  }
}

function renderDashboardShell() {
  root.innerHTML = `
    <div class="admin-shell">
      <aside class="admin-sidebar">
        <div><span class="eyebrow">IEEE CIS</span><h1>Survey Analytics</h1></div>
        <nav aria-label="Analytics views">
          <button class="admin-nav active" data-view="overview">Overview</button>
          <button class="admin-nav" data-view="choices">Choice Questions</button>
          <button class="admin-nav" data-view="open">Open Responses</button>
          <button class="admin-nav" data-view="respondents">Respondents</button>
          <button class="admin-nav" data-view="deleted">Deleted Responses <span class="nav-count" data-testid="deleted-count">${state.deletedResponses.length}</span></button>
          <button class="admin-nav" data-view="export">Export</button>
        </nav>
        <button class="secondary-button" type="button" id="admin-sign-out">Sign out</button>
      </aside>
      <main class="admin-main"><div id="admin-view" aria-live="polite"><p>Loading survey results…</p></div></main>
    </div>`;
  root.querySelector("#admin-sign-out").addEventListener("click", () => runtime.auth.signOut());
  root.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => {
    state.activeView = button.dataset.view;
    root.querySelectorAll("[data-view]").forEach((item) => item.classList.toggle("active", item === button));
    renderActiveView();
  }));
  loadResponses();
}

async function loadResponses() {
  const view = root.querySelector("#admin-view");
  if (!runtime?.data) {
    view.innerHTML = `<div class="error-summary" role="alert">The analytics data service is not configured yet.</div>`;
    return;
  }
  try {
    state.loaded = false;
    const [responses, deletedResponses] = await Promise.all([
      runtime.data.loadResponses(),
      runtime.data.loadDeletedResponses ? runtime.data.loadDeletedResponses() : Promise.resolve([]),
    ]);
    state.responses = responses;
    state.deletedResponses = deletedResponses;
    state.loaded = true;
    const count = root.querySelector('[data-testid="deleted-count"]');
    if (count) count.textContent = String(state.deletedResponses.length);
    renderActiveView();
  } catch {
    state.responses = [];
    state.deletedResponses = [];
    state.loaded = false;
    view.innerHTML = `<div class="error-summary" role="alert"><strong>Survey results could not be loaded.</strong><p>Check your connection or sign in again.</p><button class="secondary-button" id="retry-admin-load">Retry</button></div>`;
    view.querySelector("#retry-admin-load").addEventListener("click", loadResponses);
  }
}

function destroyCharts() {
  charts.forEach((chart) => chart.destroy());
  charts = [];
}

function renderActiveView() {
  destroyCharts();
  if (!state.loaded) return;
  if (state.activeView === "overview") renderOverview();
  else if (state.activeView === "choices") renderChoiceQuestions();
  else if (state.activeView === "open") renderOpenResponses();
  else if (state.activeView === "respondents") renderRespondents();
  else if (state.activeView === "deleted") renderDeletedResponses();
  else if (state.activeView === "export") renderExport();
}

function renderOverview() {
  const metrics = calculateOverview(state.responses);
  root.querySelector("#admin-view").innerHTML = `
    <header class="view-header"><div><span class="eyebrow">PRIVATE RESULTS</span><h2>Overview</h2></div><p>Updated from ${metrics.completedResponses} current response${metrics.completedResponses === 1 ? "" : "s"}.</p></header>
    <div class="metric-grid">
      <article class="metric-card"><span>Completed Responses</span><strong data-testid="completed-responses">${metrics.completedResponses}</strong><small>Total submitted questionnaires</small></article>
      <article class="metric-card"><span>Organizations Represented</span><strong data-testid="organizations-represented">${metrics.organizationsRepresented}</strong><small>Unique normalized organization names</small></article>
      <article class="metric-card"><span>Plan to Run Again</span><strong data-testid="plan-to-run-again">${metrics.planToRunAgain.percentage}%</strong><small>${metrics.planToRunAgain.yes} of ${metrics.planToRunAgain.valid} valid answers selected Yes</small></article>
    </div>
    ${state.responses.length ? `<section class="dashboard-panel"><h3>At a glance</h3><p>Use Choice Questions for full distributions and Open Responses for attributed comments.</p></section>` : `<div class="empty-state">No responses yet</div>`}`;
}

function distributionMarkup(question, distribution) {
  if (distribution.empty) {
    return `<article class="chart-card" data-chart-question="${question.id}"><h3>${question.number}. ${escapeHtml(question.prompt)}</h3><p class="empty-state">No responses yet</p></article>`;
  }
  const maximum = Math.max(...distribution.options.map(({ count }) => count), 1);
  return `<article class="chart-card" data-chart-question="${question.id}">
    <h3>${question.number}. ${escapeHtml(question.prompt)}</h3>
    <p class="chart-subtitle">${distribution.total} valid answer${distribution.total === 1 ? "" : "s"}${question.type === "multi" ? " · Respondents may select more than one option" : ""}</p>
    <div class="chart-canvas-wrap"><canvas aria-label="Distribution chart for question ${question.number}" role="img"></canvas></div>
    <div class="bar-details">${distribution.options.map((option) => `<div class="bar-row"><span>${escapeHtml(option.label)}</span><div class="bar-track"><i style="width:${(option.count / maximum) * 100}%"></i></div><strong>${option.count} · ${option.percentage}%</strong></div>`).join("")}</div>
  </article>`;
}

function renderChoiceQuestions() {
  const choiceQuestions = questions.filter(({ type }) => type !== "text");
  const distributions = choiceQuestions.map((question) => [question, distributionForQuestion(question, state.responses)]);
  const view = root.querySelector("#admin-view");
  view.innerHTML = `<header class="view-header"><div><span class="eyebrow">DISTRIBUTIONS</span><h2>Choice Questions</h2></div><p>Counts and percentages are shown after every bar.</p></header><div class="chart-list">${distributions.map(([question, distribution]) => distributionMarkup(question, distribution)).join("")}</div>`;

  if (!window.Chart) return;
  distributions.forEach(([question, distribution]) => {
    if (distribution.empty) return;
    const canvas = view.querySelector(`[data-chart-question="${question.id}"] canvas`);
    charts.push(new window.Chart(canvas, {
      type: "bar",
      data: {
        labels: distribution.options.map(({ label }) => label),
        datasets: [{ data: distribution.options.map(({ count }) => count), backgroundColor: "#4f6fd1", borderRadius: 5 }],
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: { legend: { display: false } },
        scales: { x: { beginAtZero: true, ticks: { precision: 0 } }, y: { ticks: { autoSkip: false } } },
      },
    }));
  });
}

function openResponseCards(entries) {
  if (!entries.length) return `<div class="empty-state">No matching open responses</div>`;
  return entries.map((entry) => `<article class="response-quote"><span class="question-number">Question ${entry.questionNumber}</span><h3>${escapeHtml(entry.prompt)}</h3><blockquote>${escapeHtml(entry.answer)}</blockquote><p>${escapeHtml(entry.attribution)}</p></article>`).join("");
}

function renderOpenResponses(filters = {}) {
  const allEntries = collectOpenResponses(state.responses);
  const entries = filterOpenResponses(allEntries, filters);
  const openQuestions = questions.filter((question) => question.type === "text" || question.hasOtherDetail);
  const view = root.querySelector("#admin-view");
  view.innerHTML = `
    <header class="view-header"><div><span class="eyebrow">ATTRIBUTED COMMENTS</span><h2>Open Responses</h2></div><p>${allEntries.length} non-blank answer${allEntries.length === 1 ? "" : "s"}</p></header>
    <div class="filter-bar">
      <label>Search open responses<input id="open-search" value="${escapeHtml(filters.query ?? "")}" placeholder="Name, organization, or response text"></label>
      <label>Question<select id="open-question"><option value="">All open questions</option>${openQuestions.map((question) => `<option value="${question.id}" ${filters.questionId === question.id ? "selected" : ""}>${question.number}. ${escapeHtml(question.prompt)}</option>`).join("")}</select></label>
    </div>
    <div class="response-quotes" id="open-response-list">${openResponseCards(entries)}</div>`;
  view.querySelector("#open-search").addEventListener("input", (event) => {
    renderOpenResponses({ ...filters, query: event.target.value });
    root.querySelector("#open-search")?.focus();
  });
  view.querySelector("#open-question").addEventListener("change", (event) => renderOpenResponses({ ...filters, questionId: event.target.value }));
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString("en") : "Not available";
}

function adminNoticeMarkup() {
  return state.notice ? `<div class="status-notice" role="alert">${escapeHtml(state.notice)}</div>` : "";
}

async function refreshAfterMutationConflict(dialog) {
  dialog?.close();
  state.notice = "The response changed or no longer exists. The latest data has been reloaded.";
  await loadResponses();
}

function responseAnswerRows(response) {
  return questions
    .filter((question) => response.answers?.[question.id] !== undefined)
    .map((question) => {
      return `<div><dt>${question.number}. ${escapeHtml(question.prompt)}</dt><dd>${escapeHtml(displayAnswer(question, response.answers))}</dd></div>`;
    }).join("");
}

function renderRespondents() {
  const view = root.querySelector("#admin-view");
  view.innerHTML = `
    <header class="view-header"><div><span class="eyebrow">CURRENT RECORDS</span><h2>Respondents</h2></div><p>${state.responses.length} respondent${state.responses.length === 1 ? "" : "s"}</p></header>${adminNoticeMarkup()}
    <div class="respondent-list">${state.responses.length ? state.responses.map((response) => `<article class="respondent-row"><div><h3>${escapeHtml(response.respondent_name)}</h3><p>${escapeHtml(response.organization)}</p></div><div class="respondent-times"><div class="respondent-time"><span>Created</span>${escapeHtml(formatDate(response.created_at))}</div><div class="respondent-time"><span>Last updated</span>${escapeHtml(formatDate(response.updated_at))}</div></div><div class="row-actions"><button class="secondary-button" data-view-response-id="${escapeHtml(response.id)}" aria-label="View response for ${escapeHtml(response.respondent_name)}">View</button><button class="danger-button" data-delete-response-id="${escapeHtml(response.id)}" aria-label="Delete response for ${escapeHtml(response.respondent_name)}">Delete</button></div></article>`).join("") : `<div class="empty-state">No responses yet</div>`}</div>
    <div id="response-dialog-host"></div>`;
  view.querySelectorAll("[data-view-response-id]").forEach((button) => button.addEventListener("click", () => {
    const response = state.responses.find(({ id }) => String(id) === button.dataset.viewResponseId);
    const host = view.querySelector("#response-dialog-host");
    host.innerHTML = `<dialog class="response-dialog" aria-labelledby="response-dialog-title"><div class="dialog-heading"><div><span class="eyebrow">READ-ONLY RESPONSE</span><h2 id="response-dialog-title">Response from ${escapeHtml(response.respondent_name)}</h2><p>${escapeHtml(response.organization)}</p></div><button class="text-button" id="close-response-detail">Close</button></div><div class="timestamp-grid"><p><span>Created</span>${escapeHtml(formatDate(response.created_at))}</p><p><span>Last updated</span>${escapeHtml(formatDate(response.updated_at))}</p></div><dl class="response-detail-list">${responseAnswerRows(response)}</dl></dialog>`;
    const dialog = host.querySelector("dialog");
    const closeButton = host.querySelector("#close-response-detail");
    prepareDialog(dialog, host, button, closeButton);
    closeButton.addEventListener("click", () => dialog.close());
  }));
  view.querySelectorAll("[data-delete-response-id]").forEach((button) => button.addEventListener("click", () => {
    const response = state.responses.find(({ id }) => String(id) === button.dataset.deleteResponseId);
    openSoftDeleteDialog(response, button, view.querySelector("#response-dialog-host"));
  }));
}

function prepareDialog(dialog, host, opener, initialFocus) {
  dialog.addEventListener("close", () => {
    host.innerHTML = "";
    opener.focus();
  }, { once: true });
  dialog.showModal();
  initialFocus.focus();
}

function showDialogError(dialog, message) {
  let error = dialog.querySelector("[data-dialog-error]");
  if (!error) {
    error = document.createElement("div");
    error.className = "error-summary";
    error.setAttribute("role", "alert");
    error.dataset.dialogError = "";
    dialog.querySelector(".dialog-actions").before(error);
  }
  error.textContent = message;
}

function openSoftDeleteDialog(response, opener, host) {
  host.innerHTML = `<dialog class="response-dialog confirmation-dialog" aria-labelledby="delete-dialog-title"><span class="eyebrow">MOVE TO RECYCLE BIN</span><h2 id="delete-dialog-title">Move response for ${escapeHtml(response.respondent_name)} to Deleted Responses</h2><p><strong>${escapeHtml(response.respondent_name)}</strong><br>${escapeHtml(response.organization)}</p><p>This response will immediately be excluded from analytics and CSV exports. You can restore it later.</p><div class="dialog-actions"><button class="secondary-button" type="button" data-cancel-dialog>Cancel</button><button class="danger-button" type="button" data-confirm-soft-delete>Move to Deleted Responses</button></div></dialog>`;
  const dialog = host.querySelector("dialog");
  const cancel = dialog.querySelector("[data-cancel-dialog]");
  const confirm = dialog.querySelector("[data-confirm-soft-delete]");
  prepareDialog(dialog, host, opener, cancel);
  cancel.addEventListener("click", () => dialog.close());
  confirm.addEventListener("click", async () => {
    confirm.disabled = true;
    confirm.textContent = "Moving…";
    try {
      const result = await mutationController.run("softDelete", response.id, response.version);
      if (["conflict", "not_found"].includes(result.status)) {
        await refreshAfterMutationConflict(dialog);
        return;
      }
      if (result.status !== "deleted") throw new Error("The response could not be moved.");
      state.notice = "";
      dialog.close();
      await loadResponses();
    } catch {
      showDialogError(dialog, "This response could not be moved. Check your connection and try again.");
      confirm.disabled = false;
      confirm.textContent = "Move to Deleted Responses";
    }
  });
}

function renderDeletedResponses() {
  const view = root.querySelector("#admin-view");
  view.innerHTML = `
    <header class="view-header"><div><span class="eyebrow">RECYCLE BIN</span><h2>Deleted Responses</h2></div><p>${state.deletedResponses.length} deleted response${state.deletedResponses.length === 1 ? "" : "s"}</p></header>${adminNoticeMarkup()}
    <div class="respondent-list">${state.deletedResponses.length ? state.deletedResponses.map((response) => `<article class="respondent-row deleted-row"><div><h3>${escapeHtml(response.respondent_name)}</h3><p>${escapeHtml(response.organization)}</p></div><div class="respondent-times"><div class="respondent-time"><span>Deleted</span>${escapeHtml(formatDate(response.deleted_at))}</div><div class="respondent-time"><span>Deleted by ${escapeHtml(response.deleted_by || "Administrator")}</span></div></div><div class="row-actions"><button class="secondary-button" data-restore-response-id="${escapeHtml(response.id)}" aria-label="Restore response for ${escapeHtml(response.respondent_name)}">Restore</button><button class="danger-button" data-permanent-response-id="${escapeHtml(response.id)}" aria-label="Delete permanently response for ${escapeHtml(response.respondent_name)}">Delete permanently</button></div></article>`).join("") : `<div class="empty-state">No deleted responses</div>`}</div>
    <div id="response-dialog-host"></div>`;
  view.querySelectorAll("[data-restore-response-id]").forEach((button) => button.addEventListener("click", async () => {
    const response = state.deletedResponses.find(({ id }) => String(id) === button.dataset.restoreResponseId);
    button.disabled = true;
    try {
      const result = await mutationController.run("restore", response.id, response.version);
      if (["conflict", "not_found"].includes(result.status)) {
        state.notice = "The response changed or no longer exists. The latest data has been reloaded.";
        await loadResponses();
        return;
      }
      if (result.status !== "restored") throw new Error("The response could not be restored.");
      state.notice = "";
      await loadResponses();
    } catch {
      button.disabled = false;
      const row = button.closest(".respondent-row");
      let error = row.querySelector("[role=alert]");
      if (!error) { error = document.createElement("p"); error.setAttribute("role", "alert"); row.append(error); }
      error.textContent = "This response could not be restored. Try again.";
    }
  }));
  view.querySelectorAll("[data-permanent-response-id]").forEach((button) => button.addEventListener("click", () => {
    const response = state.deletedResponses.find(({ id }) => String(id) === button.dataset.permanentResponseId);
    openPermanentDeleteDialog(response, button, view.querySelector("#response-dialog-host"));
  }));
}

function openPermanentDeleteDialog(response, opener, host) {
  const label = `Type ${response.respondent_name} to confirm`;
  host.innerHTML = `<dialog class="response-dialog confirmation-dialog" aria-labelledby="permanent-dialog-title"><span class="eyebrow">IRREVERSIBLE ACTION</span><h2 id="permanent-dialog-title">Permanently delete response for ${escapeHtml(response.respondent_name)}</h2><p>This permanently removes the response and cannot be undone.</p><label for="permanent-confirm-name">${escapeHtml(label)}</label><input id="permanent-confirm-name" autocomplete="off"><div class="dialog-actions"><button class="secondary-button" type="button" data-cancel-dialog>Cancel</button><button class="danger-button" type="button" data-confirm-permanent disabled>Delete permanently</button></div></dialog>`;
  const dialog = host.querySelector("dialog");
  const cancel = dialog.querySelector("[data-cancel-dialog]");
  const confirm = dialog.querySelector("[data-confirm-permanent]");
  const input = dialog.querySelector("#permanent-confirm-name");
  prepareDialog(dialog, host, opener, cancel);
  cancel.addEventListener("click", () => dialog.close());
  input.addEventListener("input", () => { confirm.disabled = input.value !== response.respondent_name; });
  confirm.addEventListener("click", async () => {
    confirm.disabled = true;
    confirm.textContent = "Deleting…";
    try {
      const result = await mutationController.run("permanentlyDelete", response.id, response.version, input.value);
      if (["conflict", "not_found"].includes(result.status)) {
        await refreshAfterMutationConflict(dialog);
        return;
      }
      if (result.status !== "permanently_deleted") throw new Error("The response could not be permanently deleted.");
      state.notice = "";
      dialog.close();
      await loadResponses();
    } catch {
      showDialogError(dialog, "This response could not be permanently deleted. Try again.");
      confirm.disabled = input.value !== response.respondent_name;
      confirm.textContent = "Delete permanently";
    }
  });
}

function renderExport() {
  const view = root.querySelector("#admin-view");
  view.innerHTML = `
    <header class="view-header"><div><span class="eyebrow">PORTABLE DATA</span><h2>Export</h2></div><p>Download all ${state.responses.length} current response${state.responses.length === 1 ? "" : "s"}.</p></header>
    <section class="export-card"><h3>Excel-compatible CSV</h3><p>Includes identity, timestamps, all 34 questions, multiple selections, and Other details. Potential spreadsheet formulas are neutralized.</p><button class="primary-button" id="download-csv">Download CSV</button></section>`;
  view.querySelector("#download-csv").addEventListener("click", () => {
    const blob = new Blob([buildResponsesCsv(state.responses)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `competition-organizer-survey-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  });
}

async function initialize() {
  if (!runtime?.auth) {
    renderLogin(`<strong>The analytics service is not configured yet.</strong><p>${escapeHtml(configurationError || "Add the Supabase project URL and public anonymous key in assets/js/config.js.")}</p>`);
    return;
  }
  runtime.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT" || !session) renderLogin();
    else {
      state.session = session;
      renderDashboardShell();
    }
  });
  try {
    state.session = await runtime.auth.getSession();
    if (state.session) renderDashboardShell(); else renderLogin();
  } catch {
    renderLogin("The analytics service is unavailable. Please try again.");
  }
}

initialize();

export { state };
