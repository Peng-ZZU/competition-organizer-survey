import assert from "node:assert/strict";
import test from "node:test";
import { createPersistenceAdapter, createSubmissionController } from "../../assets/js/persistence.js";

test("persistence adapter maps controlled Supabase RPC calls", async () => {
  const calls = [];
  const client = {
    async rpc(name, parameters) {
      calls.push([name, parameters]);
      if (name === "load_survey_response") return { data: [{ id: "one", version: 1 }], error: null };
      return { data: [{ status: "saved", response_version: 2 }], error: null };
    },
  };
  const adapter = createPersistenceAdapter(client);

  assert.deepEqual(await adapter.load("Jane", "ABC"), { id: "one", version: 1 });
  assert.deepEqual(await adapter.save({ name: "Jane", organization: "ABC", answers: { q01: "0" }, expectedVersion: 1 }), {
    status: "saved",
    response_version: 2,
  });
  assert.deepEqual(await adapter.save({ name: "Jane", organization: "ABC", answers: { q01: "0" }, expectedVersion: 2, allowIncomplete: true }), {
    status: "saved",
    response_version: 2,
  });
  assert.deepEqual(calls.map(([name]) => name), ["load_survey_response", "save_survey_response", "save_partial_survey_response"]);
});

test("submission controller suppresses double submit and reports saved state", async () => {
  let resolveSave;
  let calls = 0;
  const persistence = {
    save() {
      calls += 1;
      return new Promise((resolve) => { resolveSave = resolve; });
    },
  };
  const controller = createSubmissionController(persistence);
  const request = { name: "Jane", organization: "ABC", answers: {}, expectedVersion: null };
  const first = controller.submit(request);
  const second = controller.submit(request);

  assert.equal(controller.state.status, "saving");
  assert.equal(calls, 1);
  resolveSave({ status: "saved", response_version: 1, updated_at: "2026-09-04T01:00:00Z" });
  assert.deepEqual(await first, await second);
  assert.equal(controller.state.status, "saved");
});

test("submission controller exposes conflict and retryable failure states", async () => {
  let attempt = 0;
  const controller = createSubmissionController({
    async save() {
      attempt += 1;
      if (attempt === 1) throw new Error("offline");
      if (attempt === 2) return { status: "conflict", response_version: 3 };
      return { status: "saved", response_version: 4 };
    },
  });
  const request = { name: "Jane", organization: "ABC", answers: {}, expectedVersion: 2 };

  await assert.rejects(controller.submit(request), /offline/);
  assert.equal(controller.state.status, "failed");
  await controller.retry();
  assert.equal(controller.state.status, "conflict");
  await controller.submit({ ...request, expectedVersion: 3 });
  assert.equal(controller.state.status, "saved");
});
