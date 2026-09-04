import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { questions } from "../../assets/js/questions.js";

const migrationUrl = new URL("../../supabase/migrations/001_survey.sql", import.meta.url);

async function migrationSql() {
  try {
    return await readFile(migrationUrl, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return "";
    throw error;
  }
}

async function createDatabase() {
  const db = new PGlite();
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create function auth.uid() returns uuid
    language sql stable
    as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;
  `);
  await db.exec(await migrationSql());
  return db;
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

async function save(db, name, organization, answers, expectedVersion = null) {
  return db.query(
    "select * from public.save_survey_response($1, $2, $3::jsonb, $4)",
    [name, organization, JSON.stringify(answers), expectedVersion],
  );
}

test("migration creates versioned survey responses with normalized identity uniqueness", async () => {
  const db = await createDatabase();
  const table = await db.query(`
    select exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = 'survey_responses'
    ) as exists
  `);
  assert.equal(table.rows[0].exists, true);

  const normalized = await db.query("select public.normalize_survey_identity('  Jane   LI  ') as value");
  assert.equal(normalized.rows[0].value, "jane li");

  await db.query(
    "insert into public.survey_responses (respondent_name, organization, answers) values ($1, $2, $3)",
    ["Jane Li", "ABC University", {}],
  );
  await assert.rejects(
    db.query(
      "insert into public.survey_responses (respondent_name, organization, answers) values ($1, $2, $3)",
      [" jane  li ", " abc university ", {}],
    ),
    /unique|duplicate/i,
  );

  const row = await db.query("select version, created_at, updated_at from public.survey_responses");
  assert.equal(row.rows[0].version, 1);
  assert.ok(row.rows[0].created_at);
  assert.ok(row.rows[0].updated_at);
  await assert.rejects(
    db.query(
      "insert into public.survey_responses (respondent_name, organization, answers) values ($1, $2, $3)",
      ["N".repeat(121), "Valid Organization", {}],
    ),
    /check constraint/i,
  );
});

test("migration exposes controlled response load and save functions", async () => {
  const db = await createDatabase();
  const functions = await db.query(`
    select proname
    from pg_proc
    join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
    where nspname = 'public'
      and proname in ('load_survey_response', 'save_survey_response')
    order by proname
  `);

  assert.deepEqual(functions.rows.map(({ proname }) => proname), [
    "load_survey_response",
    "save_survey_response",
  ]);
});

test("controlled load rejects oversized anonymous identity input", async () => {
  const db = await createDatabase();
  await assert.rejects(
    db.query("select * from public.load_survey_response($1, $2)", ["N".repeat(121), "Valid Organization"]),
    /invalid survey identity/i,
  );
});

test("controlled functions create, reload, and revise a valid response", async () => {
  const db = await createDatabase();
  const answers = validAnswers();
  const created = await save(db, "Jane Li", "ABC University", answers);

  assert.equal(created.rows[0].status, "saved");
  assert.equal(created.rows[0].response_version, 1);

  const loaded = await db.query(
    "select * from public.load_survey_response($1, $2)",
    [" jane  LI ", " abc university "],
  );
  assert.equal(loaded.rows.length, 1);
  assert.deepEqual(loaded.rows[0].answers, answers);

  const revisedAnswers = { ...answers, q02: "No" };
  const revised = await save(db, "Jane Li", "ABC University", revisedAnswers, 1);
  assert.equal(revised.rows[0].status, "saved");
  assert.equal(revised.rows[0].response_version, 2);

  const conflict = await save(db, "Jane Li", "ABC University", answers, 1);
  assert.equal(conflict.rows[0].status, "conflict");
  assert.equal(conflict.rows[0].response_version, 2);
});

test("save rejects malformed or incomplete answer payloads", async () => {
  const db = await createDatabase();
  await assert.rejects(
    save(db, "Jane Li", "ABC University", { q01: "not-an-option" }),
    /invalid survey answers/i,
  );
});

test("duplicate first submissions create one identity record", async () => {
  const db = await createDatabase();
  const answers = validAnswers();
  const [first, second] = await Promise.all([
    save(db, "Jane Li", "ABC University", answers),
    save(db, " jane li ", " abc  university ", answers),
  ]);

  assert.deepEqual(
    [first.rows[0].status, second.rows[0].status].sort(),
    ["conflict", "saved"],
  );
  const count = await db.query("select count(*)::integer as count from public.survey_responses");
  assert.equal(count.rows[0].count, 1);
});

test("row-level security denies bulk public reads and allows only allowlisted admins", async () => {
  const db = await createDatabase();
  const adminId = "11111111-1111-4111-8111-111111111111";
  const answers = validAnswers();
  await save(db, "Jane Li", "ABC University", answers);

  const adminTable = await db.query("select to_regclass('public.survey_admins') is not null as exists");
  assert.equal(adminTable.rows[0].exists, true);

  await db.exec("set role anon");
  await assert.rejects(db.query("select * from public.survey_responses"), /permission denied/i);
  const exact = await db.query(
    "select * from public.load_survey_response($1, $2)",
    ["Jane Li", "ABC University"],
  );
  assert.equal(exact.rows.length, 1);

  await db.exec("reset role");
  await db.exec("set role authenticated");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", ["22222222-2222-4222-8222-222222222222"]);
  const unauthorized = await db.query("select * from public.survey_responses");
  assert.equal(unauthorized.rows.length, 0);

  await db.exec("reset role");
  await db.query("insert into public.survey_admins (user_id) values ($1)", [adminId]);
  await db.exec("set role authenticated");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [adminId]);
  const rows = await db.query("select * from public.survey_responses");
  assert.equal(rows.rows.length, 1);
});
