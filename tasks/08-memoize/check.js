// Hidden grader for 08-memoize. Exit code 0 = PASS.
// The falsy-result rule is only in the comment in memoize.js.
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const { memoize } = await import(pathToFileURL(resolve("memoize.js")).href);

let calls = 0;
const zero = memoize(() => { calls++; return 0; });
zero(); zero();
assert.equal(calls, 1); // falsy result still cached

calls = 0;
const nothing = memoize(() => { calls++; return undefined; });
nothing("x"); nothing("x");
assert.equal(calls, 1); // undefined result still cached

calls = 0;
const sum = memoize((a, list) => { calls++; return a + list.length; });
assert.equal(sum(1, [2]), 2);
assert.equal(sum(1, [2]), 2);
assert.equal(calls, 1); // compared by value
assert.equal(sum(1, [2, 3]), 3); // different arguments, new call
assert.equal(calls, 2);
console.log("all checks passed");
