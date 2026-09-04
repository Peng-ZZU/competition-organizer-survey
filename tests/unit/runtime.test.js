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
      return { select() { return { order: async () => ({ data: [{ id: "one" }], error: null }) }; } };
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
