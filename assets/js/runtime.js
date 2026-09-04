import { createPersistenceAdapter } from "./persistence.js";

function throwSupabaseError(error) {
  if (error) throw new Error(error.message || "Supabase request failed.", { cause: error });
}

export function readRuntimeConfig(scope = globalThis) {
  const supabaseUrl = String(scope.SURVEY_CONFIG?.supabaseUrl ?? "").trim();
  const supabaseAnonKey = String(scope.SURVEY_CONFIG?.supabaseAnonKey ?? "").trim();
  if (!supabaseUrl || !supabaseAnonKey || /replace|your[-_ ]/i.test(`${supabaseUrl} ${supabaseAnonKey}`)) {
    throw new Error("Survey storage is not configured. Add the Supabase project URL and anonymous key.");
  }
  if (/service[_-]?role/i.test(supabaseAnonKey)) {
    throw new Error("A service-role key must never be used in browser configuration.");
  }
  if (/^sb_secret_/i.test(supabaseAnonKey)) {
    throw new Error("A Supabase secret key must never be used in browser configuration.");
  }
  let parsed;
  try { parsed = new URL(supabaseUrl); } catch { throw new Error("The Supabase project URL is invalid."); }
  const localHost = ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && localHost)) {
    throw new Error("The Supabase project URL must use HTTPS, except for localhost development.");
  }
  return { supabaseUrl, supabaseAnonKey };
}

export function createBrowserRuntimes(createClient, config) {
  const client = createClient(config.supabaseUrl, config.supabaseAnonKey);
  const auth = {
    async getSession() {
      const { data, error } = await client.auth.getSession();
      throwSupabaseError(error);
      return data.session;
    },
    async signIn(email, password) {
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      throwSupabaseError(error);
      return data.session;
    },
    async signOut() {
      const { error } = await client.auth.signOut();
      throwSupabaseError(error);
    },
    onAuthStateChange(listener) {
      const { data } = client.auth.onAuthStateChange(listener);
      return () => data.subscription.unsubscribe();
    },
  };
  const data = {
    async loadResponses() {
      const { data: responses, error } = await client
        .from("survey_responses")
        .select("id, respondent_name, organization, normalized_organization, answers, version, created_at, updated_at")
        .order("updated_at", { ascending: false });
      throwSupabaseError(error);
      return responses ?? [];
    },
  };
  return {
    survey: { persistence: createPersistenceAdapter(client) },
    admin: { auth, data },
  };
}
