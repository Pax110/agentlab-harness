import assert from "node:assert/strict";
import { test } from "node:test";
import { retry } from "./retry.js";

// Returns an async function that fails `failures` times, then resolves with "ok".
function flaky(failures) {
  let calls = 0;
  const fn = async () => {
    calls++;
    if (calls <= failures) throw new Error(`fail ${calls}`);
    return "ok";
  };
  fn.calls = () => calls;
  return fn;
}

test("succeeds after a failure", async () => {
  const fn = flaky(1);
  assert.equal(await retry(fn, 3), "ok");
  assert.equal(fn.calls(), 2);
});

test("gives up after `times` calls", async () => {
  const fn = flaky(10);
  await assert.rejects(retry(fn, 3));
  assert.equal(fn.calls(), 3);
});
