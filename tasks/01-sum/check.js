// Hidden grader for 01-sum. Never shown to the agent: it sits outside repo/, so it isn't copied
// into the agent's workspace. Our grade() function runs it after the agent is done:
//   node tasks/01-sum/check.js     (with the agent's workspace as the current directory)
// The verdict is the exit code: 0 = PASS. Any failed assert throws, which ends the script
// with exit code 1 = FAIL.
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

// Load the AGENT'S sum.js. resolve("sum.js") means "sum.js in the current directory",
// and the current directory is the workspace. A plain `import "./sum.js"` would instead look
// next to this file, i.e. in tasks/01-sum/, so we build the path at runtime and import it.
const { sum } = await import(pathToFileURL(resolve("sum.js")).href);

// The checks. More than the visible test: edge cases the instruction never mentions.
assert.equal(sum([1, 2, 3]), 6); // the case from the bug report
assert.equal(sum([]), 0); // empty array
assert.equal(sum([5]), 5); // one element (the buggy loop skipped it, returning 0)
assert.equal(sum([-1, 1, 10]), 10); // negative numbers

// Only reached if every assert above passed.
console.log("all checks passed");
