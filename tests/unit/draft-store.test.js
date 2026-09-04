import assert from "node:assert/strict";
import test from "node:test";
import { createDraftStore, decideInitialSource, draftKey } from "../../assets/js/draft-store.js";

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

test("draft keys isolate normalized respondent identities", () => {
  assert.equal(draftKey({ name: " Jane  LI ", organization: " ABC University " }), "survey-draft:jane li|abc university");
});

test("draft store saves, loads, and clears a respondent draft", () => {
  const store = createDraftStore(memoryStorage());
  const identity = { name: "Jane Li", organization: "ABC University" };
  const draft = { answers: { q01: "0" }, savedAt: "2026-09-04T01:00:00.000Z" };

  assert.equal(store.save(identity, draft), true);
  assert.deepEqual(store.load(identity), draft);
  assert.equal(store.clear(identity), true);
  assert.equal(store.load(identity), null);
});

test("draft selection favors the newest source without hiding alternatives", () => {
  assert.deepEqual(decideInitialSource(null, { savedAt: "2026-09-04T02:00:00.000Z" }), {
    defaultSource: "draft",
    canRestoreDraft: true,
  });
  assert.deepEqual(
    decideInitialSource(
      { updated_at: "2026-09-04T03:00:00.000Z" },
      { savedAt: "2026-09-04T02:00:00.000Z" },
    ),
    { defaultSource: "server", canRestoreDraft: true },
  );
});

test("draft store tolerates unavailable or corrupt browser storage", () => {
  const unavailable = createDraftStore({
    getItem() { throw new Error("blocked"); },
    setItem() { throw new Error("blocked"); },
    removeItem() { throw new Error("blocked"); },
  });
  assert.equal(unavailable.save({ name: "A", organization: "B" }, {}), false);
  assert.equal(unavailable.load({ name: "A", organization: "B" }), null);
  assert.equal(unavailable.clear({ name: "A", organization: "B" }), false);

  const storage = memoryStorage();
  storage.setItem("survey-draft:a|b", "not json");
  assert.equal(createDraftStore(storage).load({ name: "A", organization: "B" }), null);
});
