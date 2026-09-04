import assert from "node:assert/strict";
import test from "node:test";
import { createBrowserRuntimes, readRuntimeConfig } from "../../assets/js/runtime.js";

test("runtime configuration accepts only a project URL and public anonymous key", () => {
  assert.throws(() => readRuntimeConfig({ SURVEY_CONFIG: { supabaseUrl: "", supabaseAnonKey: "" } }), /not configured/i);
  assert.throws(() => readRuntimeConfig({ SURVEY_CONFIG: { supabaseUrl: "https://example.supabase.co", supabaseAnonKey: "service_role.secret" } }), /service-role/i);
  assert.throws(() => readRuntimeConfig({ SURVEY_CONFIG: { supabaseUrl: "https://example.supabase.co", supabaseAnonKey: "sb_secret_private" } }), /secret key/i);
  assert.throws(() => readRuntimeConfig({ SURVEY_CONFIG: { supabaseUrl: "http://example.supabase.co", supabaseAnonKey: "public-anon-key" } }), /https/i);
  assert.deepEqual(
    readRuntimeConfig({ SURVEY_CONFIG: { supabaseUrl: "http://127.0.0.1:54321", supabaseAnonKey: "public-anon-key" } }),
    { supabaseUrl: "http://127.0.0.1:54321", supabaseAnonKey: "public-anon-key" },
  );
  assert.deepEqual(
    readRuntimeConfig({ SURVEY_CONFIG: { supabaseUrl: "https://example.supabase.co", supabaseAnonKey: "public-anon-key" } }),
    { supabaseUrl: "https://example.supabase.co", supabaseAnonKey: "public-anon-key" },
  );
});

test("browser runtimes map Supabase authentication and protected response loading", async () => {
  const calls = [];
  const client = {
    auth: {
      async getSession() { return { data: { session: { user: { email: "admin@example.com" } } }, error: null }; },
      async signInWithPassword(credentials) { calls.push(credentials);(credentials); return { data: { session: { user: { email: credentials.email } } }, error: null }; },
      async signOut() { return { error: null }; },
      onAuthStateChange(listener) { calls.push(listener); return { data: { subscription: { unsubscribe() {} } } }; },
    },
    from(table) {
      calls.push(table);
      return { select() { return { is() { return this; }, order: async () => ({ data: [{ id: "one" }], error: null }) }; } };
    },
    async rpc() { return { data: [], error: null }; },
  };
  const runtimes = createBrowserRuntimes(() => client, {
    supabaseUrl: "https://example.supabase.co",
    supabaseAnonKey: "public-anon-key",
  });

  assert.equal((await runtimes.admin.auth.getSession()).user.email, "admin@example.com");
  assert.equal((await runtimes.admin.auth.signIn("admin@example.com", "password")).user.email, "admin@example.com");
  assert.deepEqual(await runtimes.admin.data.loadResponses(), [{ id: "one" }]);
  assert.ok(runtimes.survey.persistence);
});

test("admin runtime maps active, deleted, soft-delete, restore, and permanent-delete calls", async () => {
  const calls = [];
  const query = {
    select(columns) { calls.push(["select", columns]); return this; },
    is(column, value) { calls.push(["is", column, value]); return this; },
    async order(column, options) { calls.push(["order", column, options]); return { data: [{ id: "active" }], error: null }; },
  };
  const client = {
    auth: {
      async getSession() { return { data: { session: null }, error: null }; },
      onAuthStateChange() { return { data: { subscription: { unsubscribe() {} } } }; },
    },
    from(table) { calls.push(["from", table]); return query; },
    async rpc(name, parameters) {
      calls.push(["rpc", name, parameters]);
      if (name === "list_deleted_survey_responses") return { data: [{ id: "deleted" }], error: null };
      return { data: [{ status: name }], error: null };
    },
  };
  const { admin } = createBrowserRuntimes(() => client, { supabaseUrl: "https://example.supabase.co", supabaseAnonKey: "public-anon-key" });

  assert.deepEqual(await admin.data.loadResponses(), [{ id: "active" }]);
  assert.deepEqual(await admin.data.loadDeletedResponses(), [{ id: "deleted" }]);
  assert.equal((await admin.data.softDelete("one", 2)).status, "soft_delete_survey_response");
  assert.equal((await admin.data.restore("one", 3)).status, "restore_survey_response");
  assert.equal((await admin.data.permanentlyDelete("one", 4, "Jane Li")).status, "permanently_delete_survey_response");
  assert.ok(calls.some((call) => call[0] === "is" && call[1] === "deleted_at" && call[2] === null));
});
