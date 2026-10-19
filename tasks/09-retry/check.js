// Hidden grader for 09-retry. Exit code 0 = PASS.
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const { retry } = await import(pathToFileURL(resolve("retry.js")).href);

function flaky(failures) {
  let calls = 0;
  const fn = async () => {
    calls++;
    if (calls <= failures) throw new Error(`fail ${calls}`);
    return calls;
  };
  fn.calls = () => calls;
  return fn;
}

let fn = flaky(2);
assert.equal(await retry(fn, 3), 3); // succeeds on the last allowed call
assert.equal(fn.calls(), 3);

fn = flaky(5);
await assert.rejects(retry(fn, 4), { message: "fail 4" }); // error from the LAST call
assert.equal(fn.calls(), 4); // exactly `times` calls

fn = flaky(0);
assert.equal(await retry(fn, 1), 1); // first call succeeds
assert.equal(fn.calls(), 1);
console.log("all checks passed");
