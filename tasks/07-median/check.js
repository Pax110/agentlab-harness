// Hidden grader for 07-median. Exit code 0 = PASS.
// "Does not modify the input array" is only in the comment in stats.js.
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const { median } = await import(pathToFileURL(resolve("stats.js")).href);
assert.equal(median([4, 1, 3, 2]), 2.5); // even length
assert.equal(median([100, 20, 3, 4]), 12); // numeric, not alphabetical, order
assert.equal(median([-5, -10, 0]), -5); // negatives
assert.equal(median([7]), 7);
const input = [3, 1, 2];
median(input);
assert.deepEqual(input, [3, 1, 2]); // input left untouched
console.log("all checks passed");
