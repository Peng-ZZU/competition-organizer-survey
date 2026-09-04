import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { questions } from "../../assets/js/questions.js";

const required = [
  "SURVEY_STAGING_SUPABASE_URL",
  "SURVEY_STAGING_SUPABASE_ANON_KEY",
  "SURVEY_STAGING_ADMIN_EMAIL",
  "SURVEY_STAGING_ADMIN_PASSWORD",
];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) {
  throw new Error(`Missing staging environment variables: ${missing.join(", ")}`);
}

function validAnswers() {
  return Object.fromEntries(
    questions
      .filter((question) => question.required && !question.condition)
      .map((question) => {
        if (question.type === "multi") return [question.id, [question.options[0]]];
        if (question.type === "rating") return [question.id, "3"];
        if (["q05", "q16", "q25"].includes(question.id)) return [question.id, "No"];
        return [question.id, question.options[0]];
      }),
  );
}

const url = process.env.SURVEY_STAGING_SUPABASE_URL;
const key = process.env.SURVEY_STAGING_SUPABASE_ANON_KEY;
const firstClient = createClient(url, key, { auth: { persistSession: false } });
const secondClient = createClient(url, key, { auth: { persistSession: false } });
const suffix = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
const name = `Staging Concurrency ${suffix}`;
const organization = `Staging Organization ${suffix}`;
console.log(`SYNTHETIC_IDENTITY=${name} / ${organization}`);
const parameters = {
  p_name: name,
  p_organization: organization,
  p_answers: validAnswers(),
  p_expected_version: null,
};

const [first, second] = await Promise.all([
  firstClient.rpc("save_survey_response", parameters),
  secondClient.rpc("save_survey_response", parameters),
]);
assert.equal(first.error, null);
assert.equal(second.error, null);
const statuses = [first.data[0].status, second.data[0].status].sort();
assert.deepEqual(statuses, ["conflict", "saved"]);

const loaded = await firstClient.rpc("load_survey_response", { p_name: name, p_organization: organization });
assert.equal(loaded.error, null);
assert.equal(loaded.data.length, 1);

const anonymousList = await firstClient.from("survey_responses").select("id");
assert.ok(anonymousList.error, "Anonymous bulk reads must fail.");
for (const [rpc, parameters] of [
  ["list_deleted_survey_responses", {}],
  ["soft_delete_survey_response", { p_response_id: loaded.data[0].id, p_expected_version: 1 }],
  ["restore_survey_response", { p_response_id: loaded.data[0].id, p_expected_version: 1 }],
  ["permanently_delete_survey_response", { p_response_id: loaded.data[0].id, p_expected_version: 1, p_confirm_name: name }],
]) {
  const denied = await firstClient.rpc(rpc, parameters);
  assert.ok(denied.error, `Anonymous ${rpc} must fail.`);
}

const admin = createClient(url, key, { auth: { persistSession: false } });
const signedIn = await admin.auth.signInWithPassword({
  email: process.env.SURVEY_STAGING_ADMIN_EMAIL,
  password: process.env.SURVEY_STAGING_ADMIN_PASSWORD,
});
assert.equal(signedIn.error, null);
const responseId = loaded.data[0].id;
const adminRead = await admin.from("survey_responses").select("id, version, answers").eq("id", responseId);
assert.equal(adminRead.error, null);
assert.equal(adminRead.data.length, 1);

const softDeleted = await admin.rpc("soft_delete_survey_response", { p_response_id: responseId, p_expected_version: 1 });
assert.equal(softDeleted.error, null);
assert.equal(softDeleted.data[0].status, "deleted");
assert.equal(softDeleted.data[0].response_version, 2);
const activeAfterDelete = await admin.from("survey_responses").select("id").eq("id", responseId);
assert.equal(activeAfterDelete.error, null);
assert.equal(activeAfterDelete.data.length, 0);
const hidden = await firstClient.rpc("load_survey_response", { p_name: name, p_organization: organization });
assert.equal(hidden.error, null);
assert.equal(hidden.data.length, 0);

const replacementAnswers = { ...validAnswers(), q02: "No" };
const reactivated = await firstClient.rpc("save_survey_response", {
  ...parameters,
  p_answers: replacementAnswers,
});
assert.equal(reactivated.error, null);
assert.equal(reactivated.data[0].status, "saved");
assert.equal(reactivated.data[0].response_version, 3);
const activeAfterReactivation = await admin.from("survey_responses").select("id, version, answers").eq("id", responseId);
assert.equal(activeAfterReactivation.error, null);
assert.equal(activeAfterReactivation.data.length, 1);
assert.equal(activeAfterReactivation.data[0].version, 3);
assert.equal(activeAfterReactivation.data[0].answers.q02, "No");

const deletedAgain = await admin.rpc("soft_delete_survey_response", { p_response_id: responseId, p_expected_version: 3 });
assert.equal(deletedAgain.error, null);
assert.equal(deletedAgain.data[0].status, "deleted");
const deletedList = await admin.rpc("list_deleted_survey_responses");
assert.equal(deletedList.error, null);
assert.ok(deletedList.data.some(({ id }) => id === responseId));
const activeAfterSecondDelete = await admin.from("survey_responses").select("id").eq("id", responseId);
assert.equal(activeAfterSecondDelete.error, null);
assert.equal(activeAfterSecondDelete.data.length, 0);

const restored = await admin.rpc("restore_survey_response", { p_response_id: responseId, p_expected_version: 4 });
assert.equal(restored.error, null);
assert.equal(restored.data[0].status, "restored");
const activeAfterRestore = await admin.from("survey_responses").select("id, version").eq("id", responseId);
assert.equal(activeAfterRestore.error, null);
assert.equal(activeAfterRestore.data[0].version, 5);

if (process.env.SURVEY_STAGING_NONADMIN_EMAIL && process.env.SURVEY_STAGING_NONADMIN_PASSWORD) {
  const nonAdmin = createClient(url, key, { auth: { persistSession: false } });
  const nonAdminSignIn = await nonAdmin.auth.signInWithPassword({
    email: process.env.SURVEY_STAGING_NONADMIN_EMAIL,
    password: process.env.SURVEY_STAGING_NONADMIN_PASSWORD,
  });
  assert.equal(nonAdminSignIn.error, null);
  for (const [rpc, parameters] of [
    ["list_deleted_survey_responses", {}],
    ["soft_delete_survey_response", { p_response_id: responseId, p_expected_version: 5 }],
    ["restore_survey_response", { p_response_id: responseId, p_expected_version: 5 }],
    ["permanently_delete_survey_response", { p_response_id: responseId, p_expected_version: 5, p_confirm_name: name }],
  ]) {
    const denied = await nonAdmin.rpc(rpc, parameters);
    assert.ok(denied.error, `Non-admin ${rpc} must fail.`);
  }
  console.log("NONADMIN_RECYCLE_CHECK=PASS");
} else {
  console.log("NONADMIN_RECYCLE_CHECK=SKIPPED (covered locally; set optional non-admin credentials for live coverage)");
}
const deletedForCleanup = await admin.rpc("soft_delete_survey_response", { p_response_id: responseId, p_expected_version: 5 });
assert.equal(deletedForCleanup.error, null);
assert.equal(deletedForCleanup.data[0].status, "deleted");
const permanent = await admin.rpc("permanently_delete_survey_response", {
  p_response_id: responseId,
  p_expected_version: 6,
  p_confirm_name: name,
});
assert.equal(permanent.error, null);
assert.equal(permanent.data[0].status, "permanently_deleted");
const cleaned = await admin.rpc("list_deleted_survey_responses");
assert.equal(cleaned.error, null);
assert.equal(cleaned.data.some(({ id }) => id === responseId), false);

console.log("ADMIN_RECYCLE_CHECK=PASS");
console.log("ACTIVE_DATASET_EXCLUSION=PASS");
console.log("PUBLIC_REACTIVATION_CHECK=PASS");
console.log("SYNTHETIC_CLEANUP=PASS");

console.log("Staging smoke test passed with no synthetic response left behind.");
