import assert from "node:assert/strict";
import test from "node:test";
import { createAdminMutationController } from "../../assets/js/admin-mutations.js";

test("admin mutation controller suppresses repeated clicks and reports states", async () => {
  let calls = 0;
  let finish;
  const controller = createAdminMutationController({
    softDelete() {
      calls += 1;
      return new Promise((resolve) => { finish = resolve; });
    },
  });
  const first = controller.run("softDelete", "one", 1);
  const second = controller.run("softDelete", "one", 1);
  assert.equal(calls, 1);
  assert.equal(controller.state.status, "working");
  finish({ status: "deleted" });
  assert.deepEqual(await first, await second);
  assert.equal(controller.state.status, "deleted");
});

test("admin mutation controller preserves a retryable failure", async () => {
  const controller = createAdminMutationController({ async restore() { throw new Error("offline"); } });
  await assert.rejects(controller.run("restore", "one", 2), /offline/);
  assert.equal(controller.state.status, "failed");
  assert.equal(controller.state.action, "restore");
});

test("admin mutation controller runs operations for distinct records independently", async () => {
  const calls = [];
  const finishes = new Map();
  const controller = createAdminMutationController({
    restore(id) {
      calls.push(id);
      return new Promise((resolve) => finishes.set(id, resolve));
    },
  });
  const first = controller.run("restore", "first", 2);
  const second = controller.run("restore", "second", 3);
  assert.deepEqual(calls, ["first", "second"]);
  finishes.get("first")({ status: "restored" });
  finishes.get("second")({ status: "restored" });
  await Promise.all([first, second]);
});
