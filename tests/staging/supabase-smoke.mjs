import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { questions } from "../../assets/js/questions.js";

const required = [
  "SURVEY_STAGING_SUPABASE_URL",
  "SURVEY_STAGING_SUPABASE_ANON_KEY",
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

if (process.env.SURVEY_STAGING_ADMIN_EMAIL && process.env.SURVEY_STAGING_ADMIN_PASSWORD) {
  const admin = createClient(url, key, { auth: { persistSession: false } });
  const signedIn = await admin.auth.signInWithPassword({
    email: process.env.SURVEY_STAGING_ADMIN_EMAIL,
    password: process.env.SURVEY_STAGING_ADMIN_PASSWORD,
  });
  assert.equal(signedIn.error, null);
  const adminRead = await admin.from("survey_responses").select("id").eq("id", loaded.data[0].id);
  assert.equal(adminRead.error, null);
  assert.equal(adminRead.data.length, 1);
  console.log("ADMIN_CHECK=PASS");
} else {
  console.log("ADMIN_CHECK=SKIPPED (set both staging admin variables to run it)");
}

console.log(`Staging smoke test passed. Remove synthetic response: ${name} / ${organization}`);
