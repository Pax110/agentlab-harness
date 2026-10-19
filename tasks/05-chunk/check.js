// Hidden grader for 05-chunk. Exit code 0 = PASS.
// The RangeError rule is only in the comment in chunk.js, not in the visible tests.
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const { chunk } = await import(pathToFileURL(resolve("chunk.js")).href);
assert.deepEqual(chunk([1, 2, 3], 3), [[1, 2, 3]]); // exact fit
assert.deepEqual(chunk([1, 2], 5), [[1, 2]]); // size bigger than the array
assert.deepEqual(chunk([], 3), []); // empty
assert.deepEqual(chunk([1, 2, 3, 4, 5, 6, 7], 3), [[1, 2, 3], [4, 5, 6], [7]]);
assert.throws(() => chunk([1, 2], 0), RangeError); // not positive
assert.throws(() => chunk([1, 2], 1.5), RangeError); // not an integer
console.log("all checks passed");
